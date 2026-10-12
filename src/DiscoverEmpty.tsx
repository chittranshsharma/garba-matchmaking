type Props = {
  filtersActive: boolean
  loading: boolean
  refreshing: boolean
  onRefresh: () => void
  onReset: () => void
  onProfile: () => void
}

export default function DiscoverEmpty({ filtersActive, loading, refreshing, onRefresh, onReset, onProfile }: Props) {
  return <section className="discover-empty" aria-label="No new profiles">
    <div className="discover-empty-photo" aria-hidden="true" />
    <div className="discover-empty-glow" aria-hidden="true" />
    <div className="discover-empty-orbit orbit-one" aria-hidden="true">✦</div>
    <div className="discover-empty-orbit orbit-two" aria-hidden="true">✳</div>
    <div className="discover-empty-content">
      <span className="discover-overline">✦ &nbsp; THE CIRCLE / DELHI NCR</span>
      <h2>{loading ? <>Finding your<br /><em>kind of people.</em></> : filtersActive ? <>A bigger circle<br /><em>is one tap away.</em></> : <>No new faces.<br /><em>The night is young.</em></>}</h2>
      <p>{loading ? 'Looking around the circle for someone who shares your vibe…' : filtersActive ? 'No new people match these settings right now. Open up your search and see who else is on the dance floor.' : 'You’ve seen everyone available for now. New people will appear here as they join your circle.'}</p>
      <div className="discover-empty-actions">
        <button className="discover-primary" onClick={filtersActive ? onReset : onRefresh} disabled={loading || refreshing}>{loading || refreshing ? 'Checking the circle…' : filtersActive ? 'See all of Delhi NCR' : 'Check for new people'} <span>↗</span></button>
        <button className="discover-secondary" onClick={onProfile}>Make your profile shine <span>→</span></button>
      </div>
      <div className="discover-empty-foot"><span>✳</span><div><strong>Keep your story ready.</strong><small>Good connections can start with one photo or prompt.</small></div></div>
    </div>
    <div className="discover-photo-frame" aria-hidden="true" />
    <div className="discover-ribbon" aria-hidden="true"><div>THE CIRCLE KEEPS GROWING <b>✦</b> GOOD PEOPLE, GREAT NIGHTS <b>✦</b> THE CIRCLE KEEPS GROWING <b>✦</b> GOOD PEOPLE, GREAT NIGHTS <b>✦</b></div></div>
  </section>
}
