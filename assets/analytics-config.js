// Only public settings belong here. Keep API keys in GitHub Actions secrets.
window.BmeAnalyticsConfig = Object.freeze({
  enabled: true,
  scriptUrl: 'https://cloud.umami.is/script.js',
  websiteId: '6c7f0b84-000d-459e-b9d9-eb90dc35116d',
  siteUrl: 'https://dongbaiwei.github.io/Seu-Web-Navigator/',
  title: '东南大学个人导航',
  // Set to the real first collection date, YYYY-MM-DD, when enabling tracking.
  startedAt: '2026-10-22',
  summaryUrl: 'assets/analytics-summary.json'
});
