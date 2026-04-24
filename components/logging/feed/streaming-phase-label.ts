export function getStreamingPhaseLabel(
  t: (key: string) => string,
  phase: string
) {
  switch (phase) {
    case 'connecting':
      return t('connecting');
    case 'decomposing':
      return t('decomposing');
    case 'matching':
      return t('matching');
    case 'estimating':
      return t('estimating');
    case 'assembling':
      return t('assembling');
    default:
      return t('analyzing');
  }
}
