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

// A custom entry sharing an id with a default category is an override of it:
//   name/icon/color  -> replace the default's look
//   subCategories    -> extra subs; "-:Name" hides a default sub, "!hidden" hides the category
export const HIDDEN_MARK = '!hidden';

export function mergeCategories(customCategories = []) {
  const overrides = new Map(
    customCategories.filter((c) => getCategoryById(c.id)).map((c) => [c.id, c]),
  );
  const defaults = [];
  for (const c of DEFAULT_CATEGORIES) {
    const ov = overrides.get(c.id);
    if (!ov) {
      defaults.push(c);
      continue;
    }
    const marks = ov.subCategories || [];
    if (marks.includes(HIDDEN_MARK)) continue;
    const hidden = new Set(marks.filter((s) => s.startsWith('-:')).map((s) => s.slice(2)));
    const extras = marks.filter((s) => !s.startsWith('-:') && s !== HIDDEN_MARK);
    const subs = c.subCategories.filter((s) => !hidden.has(s));
    defaults.push({
      ...c,
      name: ov.name || c.name,
      icon: ov.icon || c.icon,
      color: ov.color || c.color,
      subCategories: [...subs, ...extras.filter((s) => !subs.includes(s))],
    });
  }
  return [...defaults, ...customCategories.filter((c) => !getCategoryById(c.id))];
}

// Build the stored override for a default category from the edited result.
export function buildOverride(edited) {
  const def = getCategoryById(edited.id);
  const subs = edited.subCategories || [];
  return {
    id: edited.id,
    name: edited.name,
    icon: edited.icon,
    color: edited.color,
    subCategories: [
      ...def.subCategories.filter((s) => !subs.includes(s)).map((s) => `-:${s}`),
      ...subs.filter((s) => !def.subCategories.includes(s)),
    ],
  };
}

// Safe evaluator for "120+80*2" style input (no eval). Returns null if invalid.
export function evaluateExpression(input) {
  const s = String(input ?? '').replace(/,/g, '').replace(/[×x]/gi, '*').replace(/÷/g, '/').replace(/\s+/g, '');
  if (!s || !/^[\d.+\-*/()]+$/.test(s)) return null;
  let i = 0;
  const peek = () => s[i];
  const num = () => {
    const m = /^\d*\.?\d+|^\d+\./.exec(s.slice(i));
    if (!m) throw new Error('num');
    i += m[0].length;
    return parseFloat(m[0]);
  };
  const factor = () => {
    if (peek() === '-') { i++; return -factor(); }
    if (peek() === '+') { i++; return factor(); }
    if (peek() === '(') {
      i++;
      const v = expr();
      if (peek() !== ')') throw new Error('paren');
      i++;
      return v;
    }
    return num();
  };
  const term = () => {
    let v = factor();
    while (peek() === '*' || peek() === '/') {
      const op = s[i++];
      const r = factor();
      v = op === '*' ? v * r : v / r;
    }
    return v;
  };
  const expr = () => {
    let v = term();
    while (peek() === '+' || peek() === '-') {
      const op = s[i++];
      const r = term();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  };
  try {
    const v = expr();
    if (i !== s.length || !Number.isFinite(v)) return null;
    return Math.round(v * 100) / 100;
  } catch {
    return null;
  }
}
