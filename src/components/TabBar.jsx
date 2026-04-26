export default function TabBar({ activeTab, onTabChange }) {
  return (
    <div className="tab-bar">
      <button
        className={`tab-btn${activeTab === 'monthly' ? ' tab-btn--active' : ''}`}
        onClick={() => onTabChange('monthly')}
      >
        Monthly budget
      </button>
      <button
        className={`tab-btn${activeTab === 'retirement' ? ' tab-btn--active' : ''}`}
        onClick={() => onTabChange('retirement')}
      >
        Retirement planner
      </button>
    </div>
  )
}
