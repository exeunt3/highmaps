interface InfoTipProps {
  label?: string;
  content: string;
}

export const InfoTip = ({ label = 'What is this?', content }: InfoTipProps) => (
  <span className="info-tip" tabIndex={0} role="note" aria-label={label}>
    ⓘ
    <span className="info-tip__bubble">{content}</span>
  </span>
);
