// Everything CUET settings. Edit these values; nothing else needs to change.
window.ECUET_CONFIG = {
  // WhatsApp number for orders, alerts and senior bookings, country code first, digits only (e.g. "919876543210").
  // Empty: buttons that need it say so instead of opening WhatsApp.
  whatsapp: "",
  // Leads (Supabase project "everything-cuet"). The anon key is public by design; the database only lets
  // visitors add rows. login: "form" saves the short sign-up form (name, phone, course) to the signups table.
  // "auth" turns on Google and email-code logins, once those are set up in Supabase (cuet/supabase/README.md).
  supabase: {
    url: "https://kvfgjsnhbyduntbsxqxs.supabase.co",
    anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2Zmdqc25oYnlkdW50YnN4cXhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM3NzA1MzAsImV4cCI6MjEwOTM0NjUzMH0.i2rXj8eutxFa1qpqRGkKi7wH-sm5i8zmpdEAKjmf5Ew",
    login: "form"
  },
  // Optional form endpoint (Formspree, Google Apps Script, etc.) that receives sign-ups and orders as JSON.
  formEndpoint: "",
  instagram: "https://www.instagram.com/everythingcuet/",
  youtube: "https://www.youtube.com/@everythingcuet",
  // Photos for the homepage and section pictures. Put the files in cuet/assets/photos/ and name them here,
  // e.g. campus: "assets/photos/campus.jpg". Empty slots show the built-in illustrations.
  photos: {
    campus: "",
    senior: "",
    forms: "",
    kit: ""
  },
  // YouTube video IDs to embed on Resources and college pages.
  youtubeVideos: [],
  // Partner-college promo codes: { code: "LPU500", college: "…", saving: "₹500 off the application fee", url: "…" }
  partnerCodes: [],
  // Vetted seniors: { name, college, course, year, languages, verified: true }
  mentors: [],
  // Real reviews from students you've helped, shown on Talk to a senior: { name: "Riya S.", college: "Hindu College, DU", text: "…" }
  reviews: [],
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
