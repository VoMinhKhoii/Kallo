/** The headings and links every comparison page shares. */
export const COMPARE_CHROME = {
  pickThem: (them: string) => `Pick ${them} if`,
  pickKallo: 'Pick Kallo if',
  methodHeading: 'How we checked',
  dataLink: 'See all the numbers',
  /** On a comparison page, the link to that app's alternatives page. */
  alternativesLink: (them: string) => `Every ${them} alternative we checked`,
  /** On an alternatives page, the link to the matching comparison page. */
  compareLink: (them: string) => `Kallo and ${them} side by side`,
};
