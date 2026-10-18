export type Track = {
  id: string;
  title: string;
  ml: string;
  src: string;
  artist: string;
  license: string;
  page: string;
};

// Freely licensed recordings from Wikimedia Commons, served from /public/audio.
export const TRACKS: Track[] = [
  {
    id: 'devi-suktham',
    title: 'Devi Suktham',
    ml: 'ദേവീസൂക്തം',
    src: '/audio/devi-suktham.mp3',
    artist: 'Vedadhyayana Goshti · Mantra Manjusha',
    license: 'CC BY 3.0',
    page: 'https://commons.wikimedia.org/wiki/File:04-DEVI_SUKTHAM-MANTRA_MANJUSHA.ogg',
  },
  {
    id: 'ganapathi-suktham',
    title: 'Ganapathi Suktham',
    ml: 'ഗണപതിസൂക്തം',
    src: '/audio/ganapathi-suktham.mp3',
    artist: 'Vedadhyayana Goshti · Mantra Manjusha',
    license: 'CC BY 3.0',
    page: 'https://commons.wikimedia.org/wiki/File:03-GANAPATHI_SUKTHA-MANTRA_MANJUSHA.ogg',
  },
  {
    id: 'guru-stotram',
    title: 'Guru Stotram',
    ml: 'ഗുരുസ്തോത്രം',
    src: '/audio/guru-stotram.mp3',
    artist: 'Swami Atmananda',
    license: 'CC0',
    page: 'https://commons.wikimedia.org/wiki/File:Sanskrit_Chanting_Guru_Stotram.ogg',
  },
  {
    id: 'sree-suktham',
    title: 'Sree Suktham',
    ml: 'ശ്രീസൂക്തം',
    src: '/audio/sree-suktham.mp3',
    artist: 'Vedadhyayana Goshti · Mantra Manjusha',
    license: 'CC BY 3.0',
    page: 'https://commons.wikimedia.org/wiki/File:06-SREE_SUKTHAM-MANTRA_MANJUSHA.ogg',
  },
  {
    id: 'ramayana-dhyana',
    title: 'Ramayana Dhyana Shlokas',
    ml: 'രാമായണ ധ്യാനശ്ലോകങ്ങൾ',
    src: '/audio/ramayana-dhyana.mp3',
    artist: 'Sriram Ghanapaati & Harisitarama Murti Ghanapaati',
    license: 'CC BY-SA 2.5 IN',
    page: 'https://commons.wikimedia.org/wiki/File:Kanda_1_BK-000-Dhyana_Shlokas.ogg',
  },
  {
    id: 'gayatri',
    title: 'Gayatri Mantra',
    ml: 'ഗായത്രീമന്ത്രം',
    src: '/audio/gayatri.mp3',
    artist: 'Rameshvar',
    license: 'Free Art License',
    page: 'https://commons.wikimedia.org/wiki/File:Gayatri_Mantra_as_it_is.ogg',
  },
  {
    id: 'veena',
    title: 'Sree Neelotpala Nayike · Veena',
    ml: 'വീണ · നീലോത്പല നായികേ',
    src: '/audio/veena-nilotpala.mp3',
    artist: 'L. Ramakrishnan',
    license: 'CC0',
    page: 'https://commons.wikimedia.org/wiki/File:Shri_Nilotpala_Nayike,_rendered_on_the_Veena_by_L_Ramakishnan.ogg',
  },
];
