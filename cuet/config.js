// Everything CUET settings. Edit these values; nothing else needs to change.
window.ECUET_CONFIG = {
  // WhatsApp number for orders, alerts and senior bookings, country code first, digits only (e.g. "919876543210").
  // Empty: buttons that need it say so instead of opening WhatsApp.
  whatsapp: "",
  // Optional form endpoint (Formspree, Google Apps Script, etc.) that receives sign-ups and orders as JSON.
  formEndpoint: "",
  instagram: "https://www.instagram.com/everythingcuet/",
  youtube: "https://www.youtube.com/@everythingcuet",
  // YouTube video IDs to embed on Resources and college pages.
  youtubeVideos: [],
  // Partner-college promo codes: { code: "LPU500", college: "…", saving: "₹500 off the application fee", url: "…" }
  partnerCodes: [],
  // Vetted seniors: { name, college, course, year, languages, verified: true }
  mentors: [],
  // College-wise student groups: { university: "University of Delhi", link: "https://chat.whatsapp.com/…" }
  groups: [],
  // Upcoming webinars: { title, date: "2027-02-10T18:00", link }
  webinars: [],
  // Blog and news: { title, date: "2026-10-20", link }
  news: [],
  prices: {
    assistedForm: 99,
    csasPro: 499,
    mentor: 1999,
    mentorPlus: 2999,
    seniorCall: 199,
    bundleMinForms: 5,
    bundleDiscount: 0.3
  }
};
