export const DEFAULT_CATEGORIES = [
  {
    id: "food-dining",
    name: "Food & Dining",
    icon: "UtensilsCrossed",
    color: "#F97316",
    subCategories: [
      "Groceries",
      "Restaurants",
      "Street Food",
      "Snacks",
      "Beverages",
      "Swiggy/Zomato",
    ],
  },
  {
    id: "transport",
    name: "Transport",
    icon: "Car",
    color: "#3B82F6",
    subCategories: [
      "Fuel/Petrol",
      "Auto/Rickshaw",
      "Cab (Ola/Uber)",
      "Metro/Train",
      "Bus",
      "Parking",
      "Toll",
    ],
  },
  {
    id: "housing",
    name: "Housing",
    icon: "Home",
    color: "#8B5CF6",
    subCategories: [
      "Rent",
      "Maintenance",
      "Electricity",
      "Water",
      "Gas",
      "Internet/WiFi",
      "DTH/Cable",
    ],
  },
  {
    id: "shopping",
    name: "Shopping",
    icon: "ShoppingCart",
    color: "#EC4899",
    subCategories: [
      "Clothes",
      "Electronics",
      "Amazon/Flipkart",
      "Household Items",
      "Personal Care",
    ],
  },
  {
    id: "health",
    name: "Health",
    icon: "Heart",
    color: "#EF4444",
    subCategories: [
      "Medicine",
      "Doctor/Consultation",
      "Lab Tests",
      "Insurance Premium",
      "Gym/Fitness",
    ],
  },
  {
    id: "entertainment",
    name: "Entertainment",
    icon: "Film",
    color: "#F59E0B",
    subCategories: [
      "Movies",
      "OTT Subscriptions",
      "Games",
      "Outings",
      "Hobbies",
    ],
  },
  {
    id: "education",
    name: "Education",
    icon: "BookOpen",
    color: "#14B8A6",
    subCategories: ["Books", "Courses", "Stationery", "Coaching/Tuition"],
  },
  {
    id: "family-gifts",
    name: "Family & Gifts",
    icon: "Users",
    color: "#A855F7",
    subCategories: ["Family Support", "Gifts", "Donations", "Festivals"],
  },
  {
    id: "work-business",
    name: "Work/Business",
    icon: "Briefcase",
    color: "#6366F1",
    subCategories: [
      "Office Supplies",
      "Software/Tools",
      "Professional Services",
    ],
  },
  {
    id: "recharges-bills",
    name: "Recharges & Bills",
    icon: "Smartphone",
    color: "#06B6D4",
    subCategories: [
      "Mobile Recharge",
      "App Subscriptions",
      "Insurance",
      "EMIs",
      "Loan Payments",
    ],
  },
  {
    id: "investments",
    name: "Investments",
    icon: "TrendingUp",
    color: "#10B981",
    subCategories: ["SIP", "Stocks", "Mutual Funds", "FD", "PPF", "NPS"],
  },
  {
    id: "miscellaneous",
    name: "Miscellaneous",
    icon: "Sparkles",
    color: "#9CA3AF",
    subCategories: ["ATM Withdrawal", "Others", "Untracked"],
  },
];

export const PAYMENT_MODES = [
  { id: "cash", name: "Cash", icon: "Banknote" },
  { id: "upi", name: "UPI", icon: "Smartphone" },
  { id: "credit-card", name: "Credit Card", icon: "CreditCard" },
  { id: "debit-card", name: "Debit Card", icon: "CreditCard" },
  { id: "net-banking", name: "Net Banking", icon: "Globe" },
  { id: "wallet", name: "Wallet", icon: "Wallet" },
];

export const CURRENCY_SYMBOLS = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
};

export function getCategoryById(id) {
  return DEFAULT_CATEGORIES.find((c) => c.id === id) ?? null;
}

export function getCategoryColor(id) {
  const cat = getCategoryById(id);
  return cat?.color ?? "#9CA3AF";
}
