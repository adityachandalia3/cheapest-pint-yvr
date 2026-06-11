export type TeamColorPair = { primary: string; secondary: string };

export const FALLBACK_COLORS: TeamColorPair = { primary: '#B34207', secondary: '#FFD966' };

const TEAM_COLORS: Record<string, TeamColorPair> = {
  // CONCACAF hosts + qualifiers
  'Mexico':               { primary: '#006847', secondary: '#CE1126' },
  'Canada':               { primary: '#CE1126', secondary: '#FFFFFF' },
  'USA':                  { primary: '#002868', secondary: '#BF0A30' },
  'United States':        { primary: '#002868', secondary: '#BF0A30' },
  'Panama':               { primary: '#DB1F48', secondary: '#003F87' },
  'Honduras':             { primary: '#0073CF', secondary: '#FFFFFF' },
  'Costa Rica':           { primary: '#002B7F', secondary: '#CE1126' },
  'Jamaica':              { primary: '#000000', secondary: '#FED100' },
  'El Salvador':          { primary: '#0F47AF', secondary: '#FFFFFF' },
  'Trinidad and Tobago':  { primary: '#CE1126', secondary: '#000000' },

  // CONMEBOL
  'Argentina':            { primary: '#75AADB', secondary: '#FFFFFF' },
  'Brazil':               { primary: '#009C3B', secondary: '#FFDF00' },
  'Uruguay':              { primary: '#5AAAE7', secondary: '#FFFFFF' },
  'Colombia':             { primary: '#FFCD00', secondary: '#003087' },
  'Ecuador':              { primary: '#FFD100', secondary: '#003893' },
  'Chile':                { primary: '#D52B1E', secondary: '#FFFFFF' },
  'Paraguay':             { primary: '#D52B1E', secondary: '#009A44' },
  'Bolivia':              { primary: '#D52B1E', secondary: '#F4E400' },
  'Peru':                 { primary: '#D91023', secondary: '#FFFFFF' },
  'Venezuela':            { primary: '#CF142B', secondary: '#002EA0' },

  // UEFA
  'England':              { primary: '#CE1126', secondary: '#FFFFFF' },
  'France':               { primary: '#0055A4', secondary: '#EF4135' },
  'Germany':              { primary: '#000000', secondary: '#FFCE00' },
  'Spain':                { primary: '#AA151B', secondary: '#F1BF00' },
  'Portugal':             { primary: '#006600', secondary: '#CC0000' },
  'Netherlands':          { primary: '#FF6600', secondary: '#003DA5' },
  'Belgium':              { primary: '#000000', secondary: '#FDDA25' },
  'Croatia':              { primary: '#FF0000', secondary: '#0093DD' },
  'Switzerland':          { primary: '#FF0000', secondary: '#FFFFFF' },
  'Austria':              { primary: '#ED2939', secondary: '#FFFFFF' },
  'Denmark':              { primary: '#C60C30', secondary: '#FFFFFF' },
  'Serbia':               { primary: '#C6363C', secondary: '#0C4076' },
  'Scotland':             { primary: '#003F87', secondary: '#FFFFFF' },
  'Turkey':               { primary: '#E30A17', secondary: '#FFFFFF' },
  'Czech Republic':       { primary: '#D7141A', secondary: '#11457E' },
  'Slovakia':             { primary: '#0B4EA2', secondary: '#FFFFFF' },
  'Albania':              { primary: '#E41E20', secondary: '#000000' },
  'Ukraine':              { primary: '#005BBB', secondary: '#FFD500' },
  'Hungary':              { primary: '#CE2939', secondary: '#FFFFFF' },
  'Romania':              { primary: '#002B7F', secondary: '#FCD116' },
  'Slovenia':             { primary: '#003DA5', secondary: '#FFFFFF' },
  'Georgia':              { primary: '#FF0000', secondary: '#FFFFFF' },
  'Poland':               { primary: '#DC143C', secondary: '#FFFFFF' },
  'Wales':                { primary: '#C8102E', secondary: '#00A551' },
  'Norway':               { primary: '#EF2B2D', secondary: '#002868' },
  'Sweden':               { primary: '#006AA7', secondary: '#FECC02' },
  'Greece':               { primary: '#0D5EAF', secondary: '#FFFFFF' },

  // CAF (Africa)
  'Morocco':              { primary: '#C1272D', secondary: '#006233' },
  'Senegal':              { primary: '#00853F', secondary: '#FDEF42' },
  'Nigeria':              { primary: '#008751', secondary: '#FFFFFF' },
  'South Africa':         { primary: '#007749', secondary: '#FFB612' },
  'Cameroon':             { primary: '#007A5E', secondary: '#CE1126' },
  'Egypt':                { primary: '#CE1126', secondary: '#FFFFFF' },
  'Ghana':                { primary: '#006B3F', secondary: '#FCD116' },
  'Tunisia':              { primary: '#E70013', secondary: '#FFFFFF' },
  'Algeria':              { primary: '#006233', secondary: '#FFFFFF' },
  "Ivory Coast":          { primary: '#F77F00', secondary: '#009A44' },
  "Côte d'Ivoire":        { primary: '#F77F00', secondary: '#009A44' },
  'DR Congo':             { primary: '#007FFF', secondary: '#FFCC00' },
  'Zambia':               { primary: '#198A00', secondary: '#EF7D00' },
  'Uganda':               { primary: '#000000', secondary: '#FCDC04' },
  'Mali':                 { primary: '#14B53A', secondary: '#CE1126' },
  'Tanzania':             { primary: '#1EB53A', secondary: '#FCD116' },
  'Kenya':                { primary: '#006600', secondary: '#CC0000' },
  'Angola':               { primary: '#CC0000', secondary: '#000000' },
  'Mozambique':           { primary: '#009A44', secondary: '#FCE100' },
  'Gabon':                { primary: '#009E60', secondary: '#FCD116' },

  // AFC (Asia)
  'Japan':                { primary: '#BC002D', secondary: '#FFFFFF' },
  'South Korea':          { primary: '#003478', secondary: '#CD2E3A' },
  'Korea Republic':       { primary: '#003478', secondary: '#CD2E3A' },
  'Australia':            { primary: '#002B7F', secondary: '#FFCD00' },
  'Iran':                 { primary: '#239F40', secondary: '#DA0000' },
  'Saudi Arabia':         { primary: '#006C35', secondary: '#FFFFFF' },
  'Qatar':                { primary: '#8D1B3D', secondary: '#FFFFFF' },
  'Iraq':                 { primary: '#CE1126', secondary: '#007A3D' },
  'Jordan':               { primary: '#007A3D', secondary: '#CE1126' },
  'Uzbekistan':           { primary: '#1EB53A', secondary: '#FFFFFF' },
  'China':                { primary: '#DE2910', secondary: '#FFDE00' },
  'Indonesia':            { primary: '#CE1126', secondary: '#FFFFFF' },
  'Oman':                 { primary: '#DB161B', secondary: '#009A44' },
  'Bahrain':              { primary: '#CE1126', secondary: '#FFFFFF' },
  'Palestine':            { primary: '#000000', secondary: '#CE1126' },
  'UAE':                  { primary: '#00732F', secondary: '#FF0000' },
  'United Arab Emirates': { primary: '#00732F', secondary: '#FF0000' },
  'Thailand':             { primary: '#A51931', secondary: '#2D2A4A' },
  'India':                { primary: '#FF9933', secondary: '#138808' },
  'Kuwait':               { primary: '#007A3D', secondary: '#FF0000' },

  // OFC
  'New Zealand':          { primary: '#00247D', secondary: '#CC142B' },
};

export function getTeamColors(name: string): TeamColorPair {
  return TEAM_COLORS[name] ?? FALLBACK_COLORS;
}
