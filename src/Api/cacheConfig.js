
import { getRemainingSessionTime } from "./session.js";

const MINUTE = 60 * 1000;

// CACHE GROUPS
export const getCacheGroup = (url = "") => {
  const path = url.split("?")[0];

  if (path.startsWith("/admin/users"))
    return "users";

  if (path.startsWith("/analytics"))
    return "analytics";

  if (
    path.startsWith("/reports") ||
    path.startsWith("/advanced-reports")
  )
    return "reports";

  if (path.startsWith("/invoices"))
    return "invoices";

  return path.split("/").filter(Boolean)[0] || "other";
};

// TTL CONFIGURATION
export const getCacheTTL = (url) => {
  const remaining = getRemainingSessionTime();

  const durations = {
    analytics: 2 * MINUTE,
    reports: 5 * MINUTE,
    users: 2 * MINUTE,
    orders: 30 * 1000,
    invoices: 60 * 1000,
    products: 60 * 1000,
    cart: 30 * 1000,
  };

  const duration = durations[getCacheGroup(url)];

  return Math.min(
    duration ?? remaining,
    remaining
  );
};

// CACHE INVALIDATION DEPENDENCIES
export const cacheDependencies = {
  branches: ["branches", "analytics", "reports", "users", "trainers"],

  users: ["users", "analytics", "reports"],

  trainers: ["trainers", "analytics", "reports"],

  subscriptions: [
    "subscriptions",
    "users",
    "analytics",
    "reports",
  ],

  goals: ["goals", "workouts", "diets"],

  exercises: ["exercises", "workouts"],

  workouts: ["workouts", "analytics", "reports"],

  diets: ["diets", "reports"],

  categories: ["categories", "products"],

  products: ["products", "cart", "offers"],

  orders: [
    "orders",
    "invoices",
    "products",
    "cart",
    "analytics",
    "reports",
  ],

  offers: ["offers", "products", "cart"],

  banners: ["banners"],
};
