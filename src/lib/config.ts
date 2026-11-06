// Judah TCG Books — app config.
// The anon key is a PUBLIC key by design (RLS protects the data). Never put a service_role key here.
export const SUPABASE_URL = "https://zjsxplnyphejklsdhqxz.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpqc3hwbG55cGhlamtsc2RocXh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM5MzM3OTgsImV4cCI6MjEwOTUwOTc5OH0.83foDgdFAT7LiVqndUM03HXi4xoU7kp5xj6NOP9luvY";

// Sample/demo owner. All seeded sample data lives under this UUID.
// Morning step (Jen + Judah): create Judah's real Supabase Auth account, then either
// sign in (the app uses auth.uid() automatically) or replace this constant.
export const SAMPLE_OWNER_ID = "11111111-1111-4111-8111-111111111111";
