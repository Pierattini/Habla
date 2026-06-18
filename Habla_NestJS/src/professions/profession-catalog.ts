export type ProfessionSeed = {
  name: string;
  slug: string;
  icon: string;
  aliases?: string[];
};

export type CategorySeed = {
  name: string;
  slug: string;
  icon: string;
  description: string;
  professions: ProfessionSeed[];
};

export const PROFESSION_CATALOG: CategorySeed[] = [
  {
    name: 'Salud',
    slug: 'salud',
    icon: 'heart',
    description: 'Profesionales clinicos, medicos y terapeuticos.',
    professions: [
      { name: 'Psicologo', slug: 'psicologo', icon: 'brain', aliases: ['psicologia', 'terapia psicologica'] },
      { name: 'Nutricionista', slug: 'nutricionista', icon: 'nutrition', aliases: ['nutricion', 'dieta'] },
      { name: 'Dentista', slug: 'dentista', icon: 'tooth', aliases: ['odontologo', 'odontologia'] },
      { name: 'Cardiologo', slug: 'cardiologo', icon: 'heart-pulse', aliases: ['cardiologia'] },
      { name: 'Medico General', slug: 'medico-general', icon: 'stethoscope', aliases: ['medicina general', 'doctor'] },
      { name: 'Psiquiatra', slug: 'psiquiatra', icon: 'brain', aliases: ['psiquiatria'] },
      { name: 'Fonoaudiologo', slug: 'fonoaudiologo', icon: 'audio', aliases: ['fonoaudiologia'] },
      { name: 'Terapeuta Ocupacional', slug: 'terapeuta-ocupacional', icon: 'activity', aliases: ['terapia ocupacional'] },
    ],
  },
  {
    name: 'Belleza y Estetica',
    slug: 'belleza-estetica',
    icon: 'sparkles',
    description: 'Servicios de belleza, estetica personal y cuidado corporal.',
    professions: [
      { name: 'Peluquero', slug: 'peluquero', icon: 'scissors', aliases: ['peluqueria'] },
      { name: 'Estilista', slug: 'estilista', icon: 'sparkles', aliases: ['stylist'] },
      { name: 'Barbero', slug: 'barbero', icon: 'scissors', aliases: ['barberia'] },
      { name: 'Depilacion', slug: 'depilacion', icon: 'sparkles', aliases: ['depilador', 'depiladora'] },
      { name: 'Manicure', slug: 'manicure', icon: 'hand', aliases: ['unas', 'manicurista'] },
      { name: 'Pedicure', slug: 'pedicure', icon: 'footprints', aliases: ['pedicurista'] },
      { name: 'Maquillaje', slug: 'maquillaje', icon: 'brush', aliases: ['maquillador', 'maquilladora'] },
      { name: 'Estetica facial', slug: 'estetica-facial', icon: 'sparkles', aliases: ['facial', 'limpieza facial'] },
      { name: 'Estetica corporal', slug: 'estetica-corporal', icon: 'sparkles', aliases: ['tratamiento corporal'] },
      { name: 'Cosmetologia', slug: 'cosmetologia', icon: 'sparkles', aliases: ['cosmetica', 'cosmetologa'] },
      { name: 'Masajes', slug: 'masajes', icon: 'hand-heart', aliases: ['masajista', 'masoterapia'] },
    ],
  },
  {
    name: 'Deporte y Rehabilitacion',
    slug: 'deporte-rehabilitacion',
    icon: 'dumbbell',
    description: 'Movimiento, rehabilitacion, entrenamiento y rendimiento fisico.',
    professions: [
      { name: 'Kinesiologo', slug: 'kinesiologo', icon: 'bone', aliases: ['kinesiologia'] },
      { name: 'Fisioterapeuta', slug: 'fisioterapeuta', icon: 'activity', aliases: ['fisioterapia'] },
      { name: 'Entrenador Personal', slug: 'entrenador-personal', icon: 'dumbbell', aliases: ['personal trainer'] },
      { name: 'Preparador Fisico', slug: 'preparador-fisico', icon: 'dumbbell', aliases: ['preparacion fisica'] },
      { name: 'Quiropractico', slug: 'quiropractico', icon: 'activity', aliases: ['quiropractica', 'kiropractico'] },
    ],
  },
  {
    name: 'Asesoria Profesional',
    slug: 'asesoria-profesional',
    icon: 'briefcase',
    description: 'Servicios profesionales, legales, financieros y consultivos.',
    professions: [
      { name: 'Abogado', slug: 'abogado', icon: 'scale', aliases: ['abogada', 'legal'] },
      { name: 'Contador', slug: 'contador', icon: 'calculator', aliases: ['contabilidad'] },
      { name: 'Consultor', slug: 'consultor', icon: 'briefcase', aliases: ['consultoria'] },
      { name: 'Asesor Financiero', slug: 'asesor-financiero', icon: 'chart', aliases: ['finanzas', 'financiero'] },
    ],
  },
  {
    name: 'Educacion y Coaching',
    slug: 'educacion-coaching',
    icon: 'graduation-cap',
    description: 'Aprendizaje, acompanamiento y desarrollo personal.',
    professions: [
      { name: 'Coach', slug: 'coach', icon: 'messages', aliases: ['coaching'] },
      { name: 'Tutor', slug: 'tutor', icon: 'book', aliases: ['tutoria'] },
      { name: 'Profesor Particular', slug: 'profesor-particular', icon: 'graduation-cap', aliases: ['clases particulares', 'profesor'] },
      { name: 'Terapeuta', slug: 'terapeuta', icon: 'heart-handshake', aliases: ['terapia'] },
    ],
  },
  {
    name: 'Veterinaria',
    slug: 'veterinaria',
    icon: 'paw-print',
    description: 'Atencion y cuidado profesional de animales.',
    professions: [
      { name: 'Veterinario', slug: 'veterinario', icon: 'paw-print', aliases: ['veterinaria'] },
    ],
  },
];
