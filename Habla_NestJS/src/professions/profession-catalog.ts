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
      { name: 'Dermatologo', slug: 'dermatologo', icon: 'stethoscope', aliases: ['dermatologia'] },
      { name: 'Ginecologo', slug: 'ginecologo', icon: 'stethoscope', aliases: ['ginecologia'] },
      { name: 'Pediatra', slug: 'pediatra', icon: 'stethoscope', aliases: ['pediatria'] },
      { name: 'Traumatologo', slug: 'traumatologo', icon: 'bone', aliases: ['traumatologia'] },
      { name: 'Oftalmologo', slug: 'oftalmologo', icon: 'eye', aliases: ['oftalmologia'] },
      { name: 'Enfermero', slug: 'enfermero', icon: 'stethoscope', aliases: ['enfermeria', 'enfermera'] },
      { name: 'Matron', slug: 'matron', icon: 'stethoscope', aliases: ['matrona', 'matroneria'] },
      { name: 'Podologo', slug: 'podologo', icon: 'footprints', aliases: ['podologia'] },
      { name: 'Psicopedagogo', slug: 'psicopedagogo', icon: 'book', aliases: ['psicopedagogia'] },
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
      { name: 'Colorista', slug: 'colorista', icon: 'brush', aliases: ['coloracion', 'tintura'] },
      { name: 'Lashista', slug: 'lashista', icon: 'sparkles', aliases: ['pestanas', 'extension de pestanas'] },
      { name: 'Cejista', slug: 'cejista', icon: 'sparkles', aliases: ['cejas', 'perfilado de cejas'] },
      { name: 'Tatuador', slug: 'tatuador', icon: 'brush', aliases: ['tatuajes', 'tattoo'] },
      { name: 'Piercer', slug: 'piercer', icon: 'sparkles', aliases: ['piercing'] },
      { name: 'Esteticista', slug: 'esteticista', icon: 'sparkles', aliases: ['estetica'] },
      { name: 'Bronceado', slug: 'bronceado', icon: 'sparkles', aliases: ['bronceado organico'] },
      { name: 'Spa', slug: 'spa', icon: 'sparkles', aliases: ['relajacion', 'bienestar'] },
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
      { name: 'Osteopata', slug: 'osteopata', icon: 'activity', aliases: ['osteopatia'] },
      { name: 'Rehabilitador Deportivo', slug: 'rehabilitador-deportivo', icon: 'activity', aliases: ['rehabilitacion deportiva'] },
      { name: 'Profesor de Yoga', slug: 'profesor-yoga', icon: 'activity', aliases: ['yoga', 'instructor yoga'] },
      { name: 'Profesor de Pilates', slug: 'profesor-pilates', icon: 'activity', aliases: ['pilates', 'instructor pilates'] },
      { name: 'Nutricion Deportiva', slug: 'nutricion-deportiva', icon: 'nutrition', aliases: ['nutricionista deportivo'] },
      { name: 'Masoterapeuta Deportivo', slug: 'masoterapeuta-deportivo', icon: 'hand-heart', aliases: ['masaje deportivo'] },
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
      { name: 'Arquitecto', slug: 'arquitecto', icon: 'briefcase', aliases: ['arquitectura'] },
      { name: 'Ingeniero', slug: 'ingeniero', icon: 'briefcase', aliases: ['ingenieria'] },
      { name: 'Disenador Grafico', slug: 'disenador-grafico', icon: 'brush', aliases: ['diseno grafico', 'diseñador grafico'] },
      { name: 'Marketing Digital', slug: 'marketing-digital', icon: 'chart', aliases: ['marketing', 'publicidad digital'] },
      { name: 'Community Manager', slug: 'community-manager', icon: 'messages', aliases: ['redes sociales'] },
      { name: 'Asesor Inmobiliario', slug: 'asesor-inmobiliario', icon: 'briefcase', aliases: ['corredor de propiedades'] },
      { name: 'Traductor', slug: 'traductor', icon: 'book', aliases: ['traduccion'] },
      { name: 'Notario', slug: 'notario', icon: 'scale', aliases: ['notaria'] },
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
      { name: 'Orientador Vocacional', slug: 'orientador-vocacional', icon: 'graduation-cap', aliases: ['orientacion vocacional'] },
      { name: 'Mentor Profesional', slug: 'mentor-profesional', icon: 'messages', aliases: ['mentoria'] },
      { name: 'Profesor de Idiomas', slug: 'profesor-idiomas', icon: 'book', aliases: ['ingles', 'idiomas'] },
      { name: 'Coach Ejecutivo', slug: 'coach-ejecutivo', icon: 'briefcase', aliases: ['coaching ejecutivo'] },
      { name: 'Coach de Vida', slug: 'coach-vida', icon: 'heart-handshake', aliases: ['life coach'] },
      { name: 'Instructor Musical', slug: 'instructor-musical', icon: 'book', aliases: ['musica', 'clases de musica'] },
    ],
  },
  {
    name: 'Veterinaria',
    slug: 'veterinaria',
    icon: 'paw-print',
    description: 'Atencion y cuidado profesional de animales.',
    professions: [
      { name: 'Veterinario', slug: 'veterinario', icon: 'paw-print', aliases: ['veterinaria'] },
      { name: 'Peluqueria Canina', slug: 'peluqueria-canina', icon: 'paw-print', aliases: ['grooming', 'estetica canina'] },
      { name: 'Etologo', slug: 'etologo', icon: 'paw-print', aliases: ['conducta animal', 'comportamiento animal'] },
      { name: 'Adiestrador Canino', slug: 'adiestrador-canino', icon: 'paw-print', aliases: ['entrenador canino'] },
    ],
  },
];
