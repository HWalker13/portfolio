/** Site-wide facts. Every value here comes from CLAUDE.md; nothing is invented. */
export const site = {
  name: 'Holden Anderson',
  tagline: 'Backend & AI engineer. I build things from scratch to understand them.',
  school: 'CS at CSU San Bernardino',
  graduation: 'Graduating May 2027',
  lookingFor: 'Looking for new-grad backend, infrastructure or AI engineering roles starting June 2027.',
  description:
    'Holden Anderson, CS student at CSU San Bernardino (May 2027). Backend, infrastructure and AI engineering, with the evidence linked.',
  links: {
    github: 'https://github.com/HWalker13',
    linkedin: 'https://www.linkedin.com/in/holden-anderson123',
    resume: '/Holden-Anderson-Resume.pdf',
    email: 'holdenwalkera@gmail.com',
  },
  /** Exactly as on the resume. Credits only: Patch has no track or liner-notes page. */
  experience: [
    { role: 'Co-Founder & Engineer', rest: 'Lovely LLC, Nov 2025–Present' },
    { role: 'Lead Engineer', rest: 'Patch (P2P payments), Apr 2026–Sept 2026' },
  ],
  stack: [
    'Python',
    'FastAPI',
    'TypeScript',
    'React Native (Expo)',
    'PostgreSQL',
    'Redis',
    'Docker',
    'AWS (EC2/ECS)',
    'pytest',
  ],
} as const;
