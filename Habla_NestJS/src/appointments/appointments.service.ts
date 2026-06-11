import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  AppointmentStatus,
  DocumentMode,
  DocumentStatus,
  WeekDay,
} from '@prisma/client';
import * as nodemailer from 'nodemailer';

@Injectable()
export class AppointmentsService {
  constructor(private prisma: PrismaService) {}
  async create(
    customerId: string,
    professionalId: string,
    date: Date,
    options: {
      documentRequested?: boolean;
      documentCurrency?: string;
    } = {},
  ) {
    const now = new Date();

    if (date <= now) {
      throw new ForbiddenException(
        'You cannot book an appointment in the past',
      );
    }

    if (customerId === professionalId) {
      throw new ForbiddenException(
        'You cannot book an appointment with yourself',
      );
    }

    // 👇 Primero buscamos al professional
    const professional = await this.prisma.professional.findUnique({
      where: { userId: professionalId },
      include: { user: true },
    });

    if (!professional) {
      throw new NotFoundException('Professional not found');
    }

    if (professional.user.role !== 'PROFESSIONAL') {
      throw new ForbiddenException('Selected user is not a professional');
    }

    const customer = await this.prisma.user.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const appointmentDurationInMinutes =
      professional.duration ?? professional.user.sessionDuration ?? 60;
    const endDate = new Date(
      date.getTime() + appointmentDurationInMinutes * 60000,
    );
    // 🔎 Verificar disponibilidad del profesional

    const dayMap = [
      WeekDay.SUN,
      WeekDay.MON,
      WeekDay.TUE,
      WeekDay.WED,
      WeekDay.THU,
      WeekDay.FRI,
      WeekDay.SAT,
    ];
    // 🔥 FORZAR fecha local sin desfase
    const cleanDate = new Date(date);
    cleanDate.setHours(0, 0, 0, 0);

    const appointmentDay = dayMap[cleanDate.getDay()] as WeekDay;

    console.log('DATE RAW:', date);
    console.log('DAY CALCULADO:', appointmentDay);

    const minutesFromMidnight = date.getHours() * 60 + date.getMinutes();

    const availability = await this.prisma.availability.findFirst({
      where: {
        professionalId,
        day: appointmentDay,
        startMinute: {
          lte: minutesFromMidnight,
        },
        endMinute: {
          gte: minutesFromMidnight + appointmentDurationInMinutes,
        },
      },
    });

    if (!availability) {
      throw new ForbiddenException(
        'Professional is not available at this time',
      );
    }
    const overlappingAppointment = await this.prisma.appointment.findFirst({
      where: {
        professionalId, // ← user id
        status: AppointmentStatus.CONFIRMED,
        AND: [
          {
            date: {
              lt: endDate,
            },
          },
          {
            date: {
              gt: new Date(
                date.getTime() - appointmentDurationInMinutes * 60000,
              ),
            },
          },
        ],
      },
    });
    if (overlappingAppointment) {
      throw new ForbiddenException(
        'This time slot overlaps with another appointment',
      );
    }
    const exists = await this.prisma.appointment.findFirst({
      where: {
        professionalId, // ← user id
        date,
        status: {
          not: AppointmentStatus.CANCELLED,
        },
      },
    });

    if (exists) {
      throw new ForbiddenException('Horario ya reservado');
    }

    let finalPrice = professional.price || 0;

    // 🔥 BUSCAR CRÉDITO DISPONIBLE
    const creditAppointment = await this.prisma.appointment.findFirst({
      where: {
        customerId,
        penaltyResolved: true,
        penaltyOption: 'CREDIT',
      },
    });

    if (creditAppointment) {
      const discount = creditAppointment.penalty || 0;

      finalPrice = finalPrice - discount;

      // 🔥 marcar crédito como usado
      await this.prisma.appointment.update({
        where: { id: creditAppointment.id },
        data: {
          penaltyResolved: false,
          penaltyOption: null,
        },
      });
    }

    // 👇 crear cita con precio final
    const documentRequested = options.documentRequested === true;
    const documentCurrency = options.documentCurrency ?? 'CLP';

    const appointment = await this.prisma.appointment.create({
      data: {
        date,
        customerId,
        professionalId,
        penalty: finalPrice, // opcional (puedes usar otro campo si luego haces pricing formal)
        documentRequested,
        documentStatus: documentRequested
          ? DocumentStatus.DOCUMENT_PENDING
          : DocumentStatus.DOCUMENT_NOT_REQUIRED,
        documentRequestedAt: documentRequested ? new Date() : null,
        documentAmount: finalPrice,
        documentCurrency,
      },
    });

    if (documentRequested) {
      await this.prisma.taxDocument.upsert({
        where: { appointmentId: appointment.id },
        update: {},
        create: {
          appointmentId: appointment.id,
          status: DocumentStatus.DOCUMENT_PENDING,
          mode: DocumentMode.MANUAL,
          amount: finalPrice,
          currency: documentCurrency,
          customerTaxId: customer.taxId,
          customerTaxName: customer.taxName,
          customerTaxEmail: customer.taxEmail,
          customerTaxAddress: customer.taxAddress,
          customerTaxCountry: customer.taxCountry,
          customerTaxCity: customer.taxCity,
          professionalTaxId: professional.taxId,
          professionalTaxName: professional.taxName,
          professionalTaxEmail: professional.taxEmail,
          professionalTaxAddress: professional.taxAddress,
          professionalTaxCountry: professional.taxCountry,
          professionalTaxCity: professional.taxCity,
          events: {
            create: {
              actorId: customerId,
              type: 'DOCUMENT_CREATED',
              message: 'Tax document created from appointment request',
            },
          },
        },
      });
    }

    return appointment;
  }

  async findByProfessional(userId: string) {
    await this.releaseExpiredPayments();

    const professional = await this.prisma.professional.findUnique({
      where: { userId },
    });

    if (!professional) {
      throw new NotFoundException('Professional not found');
    }

    return this.prisma.appointment.findMany({
      where: {
        professionalId: userId,
        status: {
          not: AppointmentStatus.REFUNDED,
        },
      },
      include: {
        customer: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        professional: {
          include: {
            professional: true,
          },
        },
      },
      orderBy: {
        date: 'asc',
      },
    });
  }

  async findByCustomer(userId: string) {
    await this.releaseExpiredPayments();

    return this.prisma.appointment.findMany({
      where: { customerId: userId },
      include: {
        professional: {
          include: {
            professional: true,
          },
        },
      },
      orderBy: {
        date: 'asc',
      },
    });
  }
  async confirmAppointment(id: string, professionalId: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    if (appointment.professionalId !== professionalId) {
      throw new ForbiddenException('You cannot confirm this appointment');
    }

    return this.prisma.appointment.update({
      where: { id },
      data: { status: AppointmentStatus.CONFIRMED },
    });
  }

  async cancelAppointment(id: string, userId: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
    });

    if (!appointment) {
      throw new NotFoundException('Cita no encontrada');
    }

    if (
      appointment.customerId !== userId &&
      appointment.professionalId !== userId
    ) {
      throw new ForbiddenException('No puedes cancelar esta cita');
    }

    const now = new Date();
    const appointmentDate = new Date(appointment.date);

    const diffHours =
      (appointmentDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    const professional = await this.prisma.professional.findUnique({
      where: { userId: appointment.professionalId },
    });

    const price = professional?.price || 0;

    // 🔥 SI YA PAGÓ
    if (
      appointment.status === AppointmentStatus.PAYMENT_REVIEW ||
      appointment.status === AppointmentStatus.CONFIRMED
    ) {
      const penalty = diffHours < 48 ? price * 0.5 : 0;

      return this.prisma.appointment.update({
        where: { id },
        data: {
          status: AppointmentStatus.PENDING_PAYMENT,
          penalty,
        },
      });
    }

    // 🔥 NO PAGADA Y MENOS DE 48H
    if (diffHours < 48) {
      return this.prisma.appointment.update({
        where: { id },
        data: {
          status: AppointmentStatus.PENDING_PAYMENT,
          penalty: price * 0.5,
        },
      });
    }

    // 🔥 MÁS DE 48H
    return this.prisma.appointment.update({
      where: { id },
      data: {
        status: AppointmentStatus.CANCELLED,
        penalty: 0,
      },
    });
  }
  async getAvailableSlots(professionalId: string, date: Date) {
    const professional = await this.prisma.professional.findUnique({
    where: { userId: professionalId },
    include: { user: true },
    });

    if (!professional) {
      throw new NotFoundException('Professional not found');
    }

    const duration =
      professional.duration ?? professional.user.sessionDuration ?? 60;

    const dayMap = [
      WeekDay.SUN,
      WeekDay.MON,
      WeekDay.TUE,
      WeekDay.WED,
      WeekDay.THU,
      WeekDay.FRI,
      WeekDay.SAT,
    ];

    const cleanDate = new Date(date);

    if (isNaN(cleanDate.getTime())) {
      throw new ForbiddenException('Fecha inválida');
    }

    cleanDate.setHours(0, 0, 0, 0);

    const appointmentDay = dayMap[cleanDate.getDay()] as WeekDay;

    console.log('DATE RAW:', date);
    console.log('CLEAN DATE:', cleanDate);
    console.log('DAY CALCULADO:', appointmentDay);
    console.log('PROFESSIONAL ID:', professionalId);
    console.log('DURATION:', duration);

    const availability = await this.prisma.availability.findMany({
      where: {
        professionalId,
        day: appointmentDay,
      },
    });

    console.log('AVAILABILITY:', availability);

    const startOfDay = new Date(cleanDate);
    const endOfDay = new Date(cleanDate);
    endOfDay.setHours(23, 59, 59, 999);

    const appointments = await this.prisma.appointment.findMany({
      where: {
        professionalId,
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: AppointmentStatus.CONFIRMED,
      },
    });

    const slots: string[] = [];

    for (const block of availability) {
      for (
        let minute = block.startMinute;
        minute + duration <= block.endMinute;
        minute += duration
      ) {
        const hour = Math.floor(minute / 60)
          .toString()
          .padStart(2, '0');
        const min = (minute % 60).toString().padStart(2, '0');

        const slotTime = `${hour}:${min}`;

        const slotDate = new Date(cleanDate);
        slotDate.setHours(Math.floor(minute / 60), minute % 60, 0, 0);

        const isBooked = appointments.some(
          (appt) => appt.date.getTime() === slotDate.getTime(),
        );

        if (!isBooked) {
          slots.push(slotTime);
        }
      }
    }

    return [...new Set(slots)];
  }
  async rescheduleAppointment(
    id: string,
    userId: string,
    body: {
      date: string;
    },
  ) {
    const newDate = new Date(body.date);
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
    });

    if (!appointment) {
      throw new NotFoundException('Cita no encontrada');
    }

    // 🔐 VALIDAR DUEÑO
    if (
      appointment.customerId !== userId &&
      appointment.professionalId !== userId
    ) {
      throw new ForbiddenException('No puedes modificar esta cita');
    }

    // 🚫 NO PERMITIR REAGENDAR ESTOS ESTADOS
    if (
      appointment.status === AppointmentStatus.CANCELLED ||
      appointment.status === AppointmentStatus.PAYMENT_REVIEW
    ) {
      throw new ForbiddenException('No se puede reagendar esta cita');
    }

    const now = new Date();

    if (newDate <= now) {
      throw new ForbiddenException('No puedes reagendar al pasado');
    }

    // 🔎 PROFESIONAL
    const professional = await this.prisma.professional.findUnique({
      where: { userId: appointment.professionalId },
      include: { user: true },
    });

    if (!professional) {
      throw new NotFoundException('Professional not found');
    }

    const duration =
      professional.duration ?? professional.user.sessionDuration ?? 60;

    const startDate = newDate;
    const endDate = new Date(newDate.getTime() + duration * 60000);

    // 🔎 DISPONIBILIDAD
    const dayMap = [
      WeekDay.SUN,
      WeekDay.MON,
      WeekDay.TUE,
      WeekDay.WED,
      WeekDay.THU,
      WeekDay.FRI,
      WeekDay.SAT,
    ];

    const appointmentDay = dayMap[newDate.getDay()] as WeekDay;
    const minutesFromMidnight = newDate.getHours() * 60 + newDate.getMinutes();

    const availability = await this.prisma.availability.findFirst({
      where: {
        professionalId: appointment.professionalId,
        day: appointmentDay,
        startMinute: { lte: minutesFromMidnight },
        endMinute: { gte: minutesFromMidnight + duration },
      },
    });

    if (!availability) {
      throw new ForbiddenException('Profesional no disponible');
    }

    // 🔎 EVITAR SOLAPAMIENTO
    const overlapping = await this.prisma.appointment.findFirst({
      where: {
        professionalId: appointment.professionalId,
        id: { not: id },
        status: AppointmentStatus.CONFIRMED,
        AND: [
          { date: { lt: endDate } },
          {
            date: {
              gt: new Date(startDate.getTime() - duration * 60000),
            },
          },
        ],
      },
    });

    if (overlapping) {
      throw new ForbiddenException('Horario ocupado');
    }

    // ⚠️ PENALIZACIÓN
    // 🔥 SOLO aplicar penalización si NUNCA se ha reagendado antes
    const alreadyPenalized =
      (appointment.penalty ?? 0) > 0 &&
      appointment.status === AppointmentStatus.PENDING_PAYMENT;
    const oldDate = new Date(appointment.date);

    const diffHours = (oldDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (!alreadyPenalized && diffHours < 48) {
      const price = professional.price || 0;
      const penalty = price * 0.5;

      return this.prisma.appointment.update({
        where: { id },
        data: {
          date: newDate,
          status: AppointmentStatus.PENDING_PAYMENT,
          penalty,
        },
      });
    }

    // 🔥 CASO >48h → GRATIS
    return this.prisma.appointment.update({
      where: { id },
      data: {
        date: newDate,
        status: AppointmentStatus.RESCHEDULED,
        penalty: 0,
      },
    });
  }
  async markAsPaid(id: string, userId: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        professional: true,
      },
    });

    if (!appointment) {
      throw new NotFoundException('Cita no encontrada');
    }

    if (appointment.customerId !== userId) {
      throw new ForbiddenException('No puedes pagar esta cita');
    }

    // ✅ primero actualiza estado
    const updatedAppointment = await this.prisma.appointment.update({
      where: { id },
      data: {
        status: AppointmentStatus.PAYMENT_REVIEW,
        paidAt: new Date(), // 🔥 clave para las 48h
      },
    });

    // 🔥 luego intenta enviar correo (sin romper todo si falla)
    try {
      await this.sendPaymentEmail(
        appointment.professional.email,
        appointment.id,
      );
    } catch (error) {
      console.error('Error enviando correo de pago:', error);
    }

    return updatedAppointment;
  }
  async releaseExpiredPayments() {
    const expired = await this.prisma.appointment.findMany({
      where: {
        status: AppointmentStatus.PAYMENT_REVIEW,
        paidAt: {
          not: null,
        },
      },
    });

    for (const appt of expired) {
      if (!appt.paidAt) continue;

      const paidDate =
        appt.paidAt instanceof Date ? appt.paidAt : new Date(appt.paidAt);

      const diffHours = (Date.now() - paidDate.getTime()) / (1000 * 60 * 60);

      if (diffHours >= 48) {
        await this.prisma.appointment.update({
          where: { id: appt.id },
          data: {
            status: AppointmentStatus.PENDING,
            paidAt: null,
          },
        });
      }
    }
  }
  async confirmPayment(id: string, professionalId: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        customer: true,
        professional: true,
      },
    });

    if (!appointment) {
      throw new NotFoundException('Cita no encontrada');
    }

    if (appointment.professionalId !== professionalId) {
      throw new ForbiddenException('No puedes confirmar este pago');
    }

    // 🔥 generar link Meet
    const meetLink = `https://meet.google.com/${Math.random()
      .toString(36)
      .substring(2, 10)}`;

    // 🔥 actualizar BD
    const updated = await this.prisma.appointment.update({
      where: { id },
      data: {
        status: AppointmentStatus.CONFIRMED,
        meetLink: meetLink,
      },
    });

    // 🔥 CALCULAR ENVÍO 10 MIN ANTES
    const sendTime = new Date(appointment.date.getTime() - 10 * 60 * 1000);
    const now = new Date();
    const delay = sendTime.getTime() - now.getTime();

    if (delay > 0) {
      setTimeout(() => {
        this.sendMeetEmail(appointment.customer.email, meetLink)
          .then(() =>
            this.sendMeetEmail(appointment.professional.email, meetLink),
          )
          .then(() => console.log('📧 Correos enviados (Meet)'))
          .catch((error) => console.error('Error enviando correos:', error));
      }, delay);
    }

    return updated;
  }
  async sendPaymentEmail(to: string, appointmentId: string) {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const confirmLink = `http://localhost:3000/appointments/${appointmentId}/confirm-payment-link`;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject: 'Pago recibido - Confirmar cita',
      html: `
    <h2>💳 Pago recibido</h2>
    <p>Un cliente indicó que ya realizó el pago.</p>

    <table cellspacing="0" cellpadding="0" style="margin-top:15px;">
      <tr>
        <td align="center" bgcolor="#16a34a" style="border-radius:6px;">
          <a href="${confirmLink}"
             style="
               display:inline-block;
               padding:14px 24px;
               font-family: Arial, sans-serif;
               font-size:16px;
               font-weight:bold;
               color:#ffffff;
               text-decoration:none;
             ">
             Confirmar pago
          </a>
        </td>
      </tr>
    </table>
  `,
    });
  }

  async sendMeetEmail(to: string, meetLink: string) {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject: '📹 Tu videollamada está lista',
      html: `
      <h2>📅 Recordatorio de cita</h2>
      <p>Tu sesión comenzará en 10 minutos.</p>

      <a href="${meetLink}" 
         style="padding:10px 20px; background:#2563eb; color:white; text-decoration:none; border-radius:8px;">
         Unirse a la videollamada
      </a>
    `,
    });
  }
  async confirmPaymentFromLink(id: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
    });

    if (!appointment) {
      throw new NotFoundException('Cita no encontrada');
    }

    return this.prisma.appointment.update({
      where: { id },
      data: {
        status: AppointmentStatus.CONFIRMED,
      },
    });
  }
  async resolvePenalty(
    id: string,
    userId: string,
    body: {
      option: 'CREDIT' | 'REFUND';
      bank?: string;
      account?: string;
      accountType?: string;
    },
  ) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        customer: true,
        professional: true,
      },
    });

    if (!appointment) {
      throw new NotFoundException('Cita no encontrada');
    }

    if (appointment.customerId !== userId) {
      throw new ForbiddenException('No autorizado');
    }

    const professional = await this.prisma.professional.findUnique({
      where: { userId: appointment.professionalId },
    });

    const price = professional?.price || 0;
    const penalty = appointment.penalty || 0;

    let refundAmount = 0;

    // 🔥 MENOS DE 48H
    if (penalty > 0) {
      refundAmount = price * 0.5;
    } else {
      // 🔥 MÁS DE 48H
      refundAmount = price;
    }

    // 👉 OPCIÓN CRÉDITO
    if (body.option === 'CREDIT') {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          credit: {
            increment: refundAmount,
          },
        },
      });
    }

    // 👉 OPCIÓN REEMBOLSO
    if (body.option === 'REFUND') {
      // 🔥 VALIDAR DATOS
      if (!body.bank || !body.account || !body.accountType) {
        throw new ForbiddenException('Faltan datos bancarios');
      }
      console.log('PRICE:', price);
      console.log('PENALTY:', penalty);
      console.log('REFUND AMOUNT:', refundAmount);
      // 🔥 ENVIAR CORREO AL PROFESIONAL
      await this.sendRefundRequestEmail(
        appointment.professional.email,
        body.bank,
        body.account,
        body.accountType,
        refundAmount,
        appointment.id,
        appointment.customer.email,
        appointment.customer.name || appointment.customer.email,
      );
    }

    return this.prisma.appointment.update({
      where: { id },
      data: {
        status: AppointmentStatus.CANCELLED,
        penaltyResolved: true,
        penaltyOption: body.option,
        refundAccount: body.account || null,
        refundBank: body.bank || null,
      },
    });
  }
  async sendRefundRequestEmail(
    to: string,
    bank: string,
    account: string,
    accountType: string,
    amount: number,
    appointmentId: string,
    customerEmail: string,
    customerName: string,
  ) {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const confirmLink = `http://localhost:3000/appointments/${appointmentId}/refund-done`;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject: '💸 Solicitud de reembolso',
      html: `
  <div style="font-family:Arial,sans-serif; max-width:520px; padding:20px;">
    <h2 style="margin-bottom:16px;">💸 Solicitud de reembolso</h2>

    <p>Un cliente solicitó un reembolso.</p>

    <div style="font-size:16px; line-height:1.7; margin-top:16px;">
      <p><strong>Nombre:</strong> ${customerName}</p>
      <p><strong>Correo:</strong> ${customerEmail}</p>
      <p><strong>Banco:</strong> ${bank}</p>
      <p><strong>Tipo de cuenta:</strong> ${accountType}</p>
      <p><strong>Número de cuenta:</strong> ${account}</p>
      <p><strong>Monto:</strong> $${amount}</p>
    </div>

    <div style="margin-top:24px;">
      <a href="${confirmLink}"
         style="
           display:inline-block;
           background-color:#16a34a;
           color:#ffffff;
           padding:14px 22px;
           text-decoration:none;
           border-radius:8px;
           font-size:16px;
           font-weight:bold;
           line-height:20px;
           min-width:180px;
           text-align:center;
         ">
        Reembolso realizado
      </a>
    </div>
  </div>
`,
    });
  }
  async refundDone(id: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        customer: true,
      },
    });

    if (!appointment) {
      throw new NotFoundException('Cita no encontrada');
    }

    // 📧 enviar correo
    await this.sendRefundConfirmedEmail(
      appointment.customer.email,
      appointment.customer.name || appointment.customer.email,
    );
    // 🔥 CAMBIAR ESTADO
    return this.prisma.appointment.update({
      where: { id },
      data: {
        status: AppointmentStatus.REFUNDED,
      },
    });
  }
  async sendRefundConfirmedEmail(to: string, name: string) {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject: '💸 Reembolso realizado',
      html: `
      <div style="font-family:Arial; padding:20px;">
        <h2>💸 Reembolso confirmado</h2>

        <p>Hola ${name},</p>

        <p>El profesional ya ha realizado tu reembolso.</p>

        <p>El dinero debería verse reflejado en tu cuenta según tu banco.</p>

        <br/>

        <p>Gracias por usar Habla 👋</p>
      </div>
    `,
    });
  }
}
