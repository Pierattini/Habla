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
      { name: 'Psicólogo(a)', slug: 'psicologo', icon: 'brain', aliases: ['psicologia', 'terapia psicologica'] },
      { name: 'Nutricionista', slug: 'nutricionista', icon: 'nutrition', aliases: ['nutricion', 'dieta'] },
      { name: 'Dentista', slug: 'dentista', icon: 'tooth', aliases: ['odontologo', 'odontologia'] },
      { name: 'Cardiólogo(a)', slug: 'cardiologo', icon: 'heart-pulse', aliases: ['cardiologia'] },
      { name: 'Médico(a) General', slug: 'medico-general', icon: 'stethoscope', aliases: ['medicina general', 'doctor'] },
      { name: 'Psiquiatra', slug: 'psiquiatra', icon: 'brain', aliases: ['psiquiatria'] },
      { name: 'Fonoaudiólogo(a)', slug: 'fonoaudiologo', icon: 'audio', aliases: ['fonoaudiologia'] },
      { name: 'Terapeuta Ocupacional', slug: 'terapeuta-ocupacional', icon: 'activity', aliases: ['terapia ocupacional'] },
      { name: 'Dermatólogo(a)', slug: 'dermatologo', icon: 'stethoscope', aliases: ['dermatologia'] },
      { name: 'Ginecólogo(a)', slug: 'ginecologo', icon: 'stethoscope', aliases: ['ginecologia'] },
      { name: 'Pediatra', slug: 'pediatra', icon: 'stethoscope', aliases: ['pediatria'] },
      { name: 'Traumatólogo(a)', slug: 'traumatologo', icon: 'bone', aliases: ['traumatologia'] },
      { name: 'Oftalmólogo(a)', slug: 'oftalmologo', icon: 'eye', aliases: ['oftalmologia'] },
      { name: 'Enfermero(a)', slug: 'enfermero', icon: 'stethoscope', aliases: ['enfermeria', 'enfermera'] },
      { name: 'Matrón(a)', slug: 'matron', icon: 'stethoscope', aliases: ['matrona', 'matroneria'] },
      { name: 'Podólogo(a)', slug: 'podologo', icon: 'footprints', aliases: ['podologia'] },
      { name: 'Psicopedagogo(a)', slug: 'psicopedagogo', icon: 'book', aliases: ['psicopedagogia'] },
    ],
  },
  {
    name: 'Belleza y Estética',
    slug: 'belleza-estetica',
    icon: 'sparkles',
    description: 'Servicios de belleza, estetica personal y cuidado corporal.',
    professions: [
      { name: 'Peluquero(a)', slug: 'peluquero', icon: 'scissors', aliases: ['peluqueria'] },
      { name: 'Estilista', slug: 'estilista', icon: 'sparkles', aliases: ['stylist'] },
      { name: 'Barbero(a)', slug: 'barbero', icon: 'scissors', aliases: ['barberia'] },
      { name: 'Depilación', slug: 'depilacion', icon: 'sparkles', aliases: ['depilador', 'depiladora'] },
      { name: 'Manicure', slug: 'manicure', icon: 'hand', aliases: ['unas', 'manicurista'] },
      { name: 'Pedicure', slug: 'pedicure', icon: 'footprints', aliases: ['pedicurista'] },
      { name: 'Maquillaje', slug: 'maquillaje', icon: 'brush', aliases: ['maquillador', 'maquilladora'] },
      { name: 'Estética facial', slug: 'estetica-facial', icon: 'sparkles', aliases: ['facial', 'limpieza facial'] },
      { name: 'Estética corporal', slug: 'estetica-corporal', icon: 'sparkles', aliases: ['tratamiento corporal'] },
      { name: 'Cosmetología', slug: 'cosmetologia', icon: 'sparkles', aliases: ['cosmetica', 'cosmetologa'] },
      { name: 'Masajes', slug: 'masajes', icon: 'hand-heart', aliases: ['masajista', 'masoterapia'] },
      { name: 'Colorista', slug: 'colorista', icon: 'brush', aliases: ['coloracion', 'tintura'] },
      { name: 'Lashista', slug: 'lashista', icon: 'sparkles', aliases: ['pestanas', 'extension de pestanas'] },
      { name: 'Cejista', slug: 'cejista', icon: 'sparkles', aliases: ['cejas', 'perfilado de cejas'] },
      { name: 'Tatuador(a)', slug: 'tatuador', icon: 'brush', aliases: ['tatuajes', 'tattoo'] },
      { name: 'Piercer', slug: 'piercer', icon: 'sparkles', aliases: ['piercing'] },
      { name: 'Esteticista', slug: 'esteticista', icon: 'sparkles', aliases: ['estetica'] },
      { name: 'Bronceado', slug: 'bronceado', icon: 'sparkles', aliases: ['bronceado organico'] },
      { name: 'Spa', slug: 'spa', icon: 'sparkles', aliases: ['relajacion', 'bienestar'] },
    ],
  },
  {
    name: 'Deporte y Rehabilitación',
    slug: 'deporte-rehabilitacion',
    icon: 'dumbbell',
    description: 'Movimiento, rehabilitacion, entrenamiento y rendimiento fisico.',
    professions: [
      { name: 'Kinesiólogo(a)', slug: 'kinesiologo', icon: 'bone', aliases: ['kinesiologia'] },
      { name: 'Fisioterapeuta', slug: 'fisioterapeuta', icon: 'activity', aliases: ['fisioterapia'] },
      { name: 'Entrenador(a) Personal', slug: 'entrenador-personal', icon: 'dumbbell', aliases: ['personal trainer'] },
      { name: 'Preparador(a) Físico(a)', slug: 'preparador-fisico', icon: 'dumbbell', aliases: ['preparación fisica'] },
      { name: 'Quiropráctico(a)', slug: 'quiropractico', icon: 'activity', aliases: ['quiropractica', 'kiropractico'] },
      { name: 'Osteópata', slug: 'osteopata', icon: 'activity', aliases: ['osteopatia'] },
      { name: 'Rehabilitador(a) Deportivo(a)', slug: 'rehabilitador-deportivo', icon: 'activity', aliases: ['rehabilitacion deportiva'] },
      { name: 'Profesor(a) de Yoga', slug: 'profesor-yoga', icon: 'activity', aliases: ['yoga', 'instructor yoga'] },
      { name: 'Profesor(a) de Pilates', slug: 'profesor-pilates', icon: 'activity', aliases: ['pilates', 'instructor pilates'] },
      { name: 'Nutrición Deportiva', slug: 'nutricion-deportiva', icon: 'nutrition', aliases: ['nutricionista deportivo'] },
      { name: 'Masoterapeuta Deportivo(a)', slug: 'masoterapeuta-deportivo', icon: 'hand-heart', aliases: ['masaje deportivo'] },
    ],
  },
  {
    name: 'Asesoría Profesional',
    slug: 'asesoria-profesional',
    icon: 'briefcase',
    description: 'Servicios profesionales, legales, financieros y consultivos.',
    professions: [
      { name: 'Abogado(a)', slug: 'abogado', icon: 'scale', aliases: ['abogada', 'legal'] },
      { name: 'Contador(a)', slug: 'contador', icon: 'calculator', aliases: ['contabilidad'] },
      { name: 'Consultor(a)', slug: 'consultor', icon: 'briefcase', aliases: ['consultoria'] },
      { name: 'Asesor(a) Financiero(a)', slug: 'asesor-financiero', icon: 'chart', aliases: ['finanzas', 'financiero'] },
      { name: 'Arquitecto(a)', slug: 'arquitecto', icon: 'briefcase', aliases: ['arquitectura'] },
      { name: 'Ingeniero(a)', slug: 'ingeniero', icon: 'briefcase', aliases: ['ingenieria'] },
      { name: 'Diseñador(a) Gráfico(a)', slug: 'disenador-grafico', icon: 'brush', aliases: ['diseno grafico', 'diseñador grafico'] },
      { name: 'Marketing Digital', slug: 'marketing-digital', icon: 'chart', aliases: ['marketing', 'publicidad digital'] },
      { name: 'Community Manager', slug: 'community-manager', icon: 'messages', aliases: ['redes sociales'] },
      { name: 'Asesor(a) Inmobiliario(a)', slug: 'asesor-inmobiliario', icon: 'briefcase', aliases: ['corredor de propiedades'] },
      { name: 'Traductor(a)', slug: 'traductor', icon: 'book', aliases: ['traduccion'] },
      { name: 'Notario(a)', slug: 'notario', icon: 'scale', aliases: ['notaria'] },
    ],
  },
  {
    name: 'Educación y Coaching',
    slug: 'educacion-coaching',
    icon: 'graduation-cap',
    description: 'Aprendizaje, acompanamiento y desarrollo personal.',
    professions: [
      { name: 'Coach', slug: 'coach', icon: 'messages', aliases: ['coaching'] },
      { name: 'Tutor(a)', slug: 'tutor', icon: 'book', aliases: ['tutoria'] },
      { name: 'Profesor(a) Particular', slug: 'profesor-particular', icon: 'graduation-cap', aliases: ['clases particulares', 'profesor'] },
      { name: 'Terapeuta', slug: 'terapeuta', icon: 'heart-handshake', aliases: ['terapia'] },
      { name: 'Orientador(a) Vocacional', slug: 'orientador-vocacional', icon: 'graduation-cap', aliases: ['orientacion vocacional'] },
      { name: 'Mentor(a) Profesional', slug: 'mentor-profesional', icon: 'messages', aliases: ['mentoria'] },
      { name: 'Profesor(a) de Idiomas', slug: 'profesor-idiomas', icon: 'book', aliases: ['ingles', 'idiomas'] },
      { name: 'Coach Ejecutivo(a)', slug: 'coach-ejecutivo', icon: 'briefcase', aliases: ['coaching ejecutivo'] },
      { name: 'Coach de Vida', slug: 'coach-vida', icon: 'heart-handshake', aliases: ['life coach'] },
      { name: 'Instructor(a) Musical', slug: 'instructor-musical', icon: 'book', aliases: ['musica', 'clases de musica'] },
    ],
  },
  {
    name: 'Veterinaria',
    slug: 'veterinaria',
    icon: 'paw-print',
    description: 'Atención y cuidado profesional de animales.',
    professions: [
      { name: 'Veterinario(a)', slug: 'veterinario', icon: 'paw-print', aliases: ['veterinaria'] },
      { name: 'Peluquería Canina', slug: 'peluqueria-canina', icon: 'paw-print', aliases: ['grooming', 'estetica canina'] },
      { name: 'Etólogo(a)', slug: 'etologo', icon: 'paw-print', aliases: ['conducta animal', 'comportamiento animal'] },
      { name: 'Adiestrador(a) Canino(a)', slug: 'adiestrador-canino', icon: 'paw-print', aliases: ['entrenador canino'] },
    ],
  },
];
