import { useEffect } from "react";
import { doc, setDoc, increment } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { trackEvent } from "@/lib/analytics";

interface Props {
  onNavigate: (screen: string) => void;
}

const SHOPIFY_URL = "https://brownworks4u2.myshopify.com";
const DISCOUNT_CODE = "FOUNDING20";

const PRODUCTS = [
  {
    id: "cooling-towels",
    emoji: "🧊",
    name: "Cooling Towels",
    tagline: "Stay cool on the go",
    gradient: "linear-gradient(135deg, #0BC5EA 0%, #0E7490 100%)",
    textColor: "#E0F7FA",
  },
  {
    id: "tees",
    emoji: "🔥",
    name: "FLASHYAF™ Tees",
    tagline: "Wear your power",
    gradient: "linear-gradient(135deg, #FF6B35 0%, #C0392B 100%)",
    textColor: "#FFE0D6",
  },
  {
    id: "bottles",
    emoji: "💧",
    name: "Insulated Water Bottles",
    tagline: "Hydration is everything",
    gradient: "linear-gradient(135deg, #2980B9 0%, #1A5276 100%)",
    textColor: "#D6EAF8",
  },
  {
    id: "neck-wraps",
    emoji: "❄️",
    name: "Cooling Neck Wraps",
    tagline: "Instant relief anywhere",
    gradient: "linear-gradient(135deg, #16A085 0%, #0B7C64 100%)",
    textColor: "#D1F2EB",
  },
  {
    id: "journal",
    emoji: "📓",
    name: "Journal & Planner",
    tagline: "Track everything analog too",
    gradient: "linear-gradient(135deg, #8E44AD 0%, #6C3483 100%)",
    textColor: "#E8DAEF",
  },
  {
    id: "gift-sets",
    emoji: "🎁",
    name: "Gift Sets",
    tagline: "For the woman in your life who needs this",
    gradient: "linear-gradient(135deg, #B8860B 0%, #8B6914 100%)",
    textColor: "#FEF9E7",
  },
];

export default function ShopScreen({ onNavigate }: Props) {
  const { user } = useAuth();

  useEffect(() => {
    trackEvent("shop_opened");
    if (!user) return;
    setDoc(
      doc(db, "shopViews", user.uid),
      {
        userId: user.uid,
        userEmail: user.email || "",
        lastViewed: Date.now(),
        viewCount: increment(1),
      },
      { merge: true }
    ).catch(() => {});
  }, [user]);

  function shopNow(productId?: string) {
    trackEvent("premium_upgrade_tapped", { product_id: productId ?? "all" });
    const url = productId ? `${SHOPIFY_URL}/collections/${productId}` : SHOPIFY_URL;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div style={s.container}>
      {/* Header */}
      <div style={s.header}>
        <p style={s.appName}>FLASHYAF™</p>
        <p style={s.headerTitle}>Shop</p>
        <p style={s.headerSub}>Gear that gets it.</p>
      </div>

      <div style={s.scroll}>
        {/* Hero Banner */}
        <div style={s.heroBanner}>
          <div style={s.heroLeft}>
            <p style={s.heroTitle}>Gear designed for women who refuse to just survive menopause.</p>
            <div style={s.shippingPill}>
              <span style={s.shippingIcon}>🚚</span>
              <span style={s.shippingText}>Free shipping on orders over $50</span>
            </div>
          </div>
          <span style={s.heroEmoji}>🛍️</span>
        </div>

        {/* Beta Discount */}
        <div style={s.discountCard}>
          <div style={s.discountTop}>
            <div style={s.discountLeft}>
              <div style={s.discountBadge}>
                <span style={s.discountBadgeIcon}>🌟</span>
                <span style={s.discountBadgeText}>BETA FOUNDER EXCLUSIVE</span>
              </div>
              <p style={s.discountTitle}>20% Off Your First Order</p>
              <p style={s.discountSub}>As a founding member, this one's for you.</p>
            </div>
          </div>
          <div style={s.codeWrap}>
            <p style={s.codeLabel}>Your discount code</p>
            <div style={s.codeBox}>
              <span style={s.codeText}>{DISCOUNT_CODE}</span>
              <button
                style={s.copyBtn}
                onClick={() => {
                  navigator.clipboard?.writeText(DISCOUNT_CODE).catch(() => {});
                }}
              >
                Copy
              </button>
            </div>
            <p style={s.codeNote}>Apply at checkout · one-time use · all products</p>
          </div>
          <button style={s.discountShopBtn} onClick={() => shopNow()}>
            Shop Now — Use {DISCOUNT_CODE} →
          </button>
        </div>

        {/* Section label */}
        <p style={s.sectionLabel}>PRODUCTS</p>

        {/* Product grid */}
        <div style={s.productGrid}>
          {PRODUCTS.map((p) => (
            <div key={p.id} style={s.productCard}>
              {/* Placeholder image */}
              <div style={{ ...s.productImage, background: p.gradient }}>
                <span style={s.productEmoji}>{p.emoji}</span>
                <div style={{ ...s.productImageOverlay, background: p.gradient.replace("135deg", "to top") }} />
              </div>
              {/* Card body */}
              <div style={s.productBody}>
                <p style={s.productName}>{p.name}</p>
                <p style={s.productTagline}>{p.tagline}</p>
                <button
                  style={s.shopNowBtn}
                  onClick={() => shopNow(p.id)}
                >
                  Shop Now →
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* All products CTA */}
        <button style={s.allProductsBtn} onClick={() => shopNow()}>
          View All Products at FLASHYAF™ Store →
        </button>

        {/* Disclaimer */}
        <div style={s.disclaimer}>
          <p style={s.disclaimerText}>
            🔒 You'll be taken to our secure Shopify store. All purchases are processed safely via Shopify Payments.
          </p>
        </div>

        <div style={{ height: "28px" }} />
      </div>

      {/* 6-tab bottom nav */}
      <div style={s.bottomNav}>
        <button style={s.navBtn} onClick={() => onNavigate("home")}>
          <span>🏠</span><span style={s.navLabel}>Home</span>
        </button>
        <button style={s.navBtn} onClick={() => onNavigate("history")}>
          <span>📋</span><span style={s.navLabel}>History</span>
        </button>
        <button style={s.navBtn} onClick={() => onNavigate("community")}>
          <span>💬</span><span style={s.navLabel}>Community</span>
        </button>
        <button style={s.navBtn} onClick={() => onNavigate("learn")}>
          <span>📚</span><span style={s.navLabel}>Learn</span>
        </button>
        <button style={{ ...s.navBtn, ...s.navBtnActive }} onClick={() => onNavigate("shop")}>
          <span>🛍️</span><span style={s.navLabel}>Shop</span>
        </button>
        <button style={s.navBtn} onClick={() => onNavigate("settings")}>
          <span>⚙️</span><span style={s.navLabel}>Settings</span>
        </button>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh", background: "var(--color-bg)",
    display: "flex", flexDirection: "column",
    maxWidth: "480px", margin: "0 auto",
    fontFamily: "'Inter', sans-serif",
  },
  header: {
    padding: "18px 16px 12px", textAlign: "center",
    borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0,
  },
  appName: {
    color: "var(--color-accent)", fontSize: "11px", fontWeight: 900,
    letterSpacing: "2px", margin: "0 0 2px",
  },
  headerTitle: { color: "#fff", fontSize: "22px", fontWeight: 800, margin: "0 0 2px" },
  headerSub: { color: "rgba(255,255,255,0.4)", fontSize: "13px", margin: 0 },
  scroll: {
    flex: 1, overflowY: "auto",
    padding: "14px 12px 0",
    display: "flex", flexDirection: "column", gap: "12px",
  },

  // Hero Banner
  heroBanner: {
    background: "linear-gradient(135deg, #1A0A00 0%, #2D1200 50%, #1A0A00 100%)",
    border: "1px solid rgba(255,107,53,0.35)",
    borderRadius: "18px", padding: "18px 16px",
    display: "flex", alignItems: "center", gap: "12px",
    boxShadow: "0 4px 24px rgba(255,69,0,0.15)",
  },
  heroLeft: { flex: 1 },
  heroTitle: {
    color: "#fff", fontSize: "15px", fontWeight: 800,
    lineHeight: 1.4, margin: "0 0 10px", letterSpacing: "-0.2px",
  },
  shippingPill: {
    display: "inline-flex", alignItems: "center", gap: "6px",
    background: "rgba(255,255,255,0.08)", borderRadius: "100px",
    padding: "5px 12px",
  },
  shippingIcon: { fontSize: "13px" },
  shippingText: { color: "rgba(255,255,255,0.75)", fontSize: "12px", fontWeight: 600 },
  heroEmoji: { fontSize: "48px", flexShrink: 0, lineHeight: 1 },

  // Discount Card
  discountCard: {
    background: "linear-gradient(135deg, #1A1400 0%, #2D2000 100%)",
    border: "1px solid rgba(255,215,0,0.35)",
    borderRadius: "18px", padding: "18px 16px",
    display: "flex", flexDirection: "column", gap: "14px",
    boxShadow: "0 4px 32px rgba(255,215,0,0.1)",
  },
  discountTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  discountLeft: { display: "flex", flexDirection: "column", gap: "6px" },
  discountBadge: {
    display: "inline-flex", alignItems: "center", gap: "6px",
    background: "rgba(255,215,0,0.12)", border: "1px solid rgba(255,215,0,0.3)",
    borderRadius: "100px", padding: "4px 12px",
    width: "fit-content",
  },
  discountBadgeIcon: { fontSize: "12px" },
  discountBadgeText: {
    color: "#FFD700", fontSize: "10px", fontWeight: 900,
    letterSpacing: "1.5px", textTransform: "uppercase",
  },
  discountTitle: { color: "#fff", fontSize: "18px", fontWeight: 900, margin: 0, letterSpacing: "-0.3px" },
  discountSub: { color: "rgba(255,255,255,0.5)", fontSize: "13px", margin: 0 },
  codeWrap: { display: "flex", flexDirection: "column", gap: "6px" },
  codeLabel: { color: "rgba(255,255,255,0.4)", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", margin: 0 },
  codeBox: {
    display: "flex", alignItems: "center", gap: "10px",
    background: "rgba(255,215,0,0.08)", border: "1px dashed rgba(255,215,0,0.4)",
    borderRadius: "12px", padding: "12px 16px",
  },
  codeText: {
    flex: 1, color: "#FFD700", fontSize: "22px", fontWeight: 900,
    letterSpacing: "4px", fontFamily: "monospace",
  },
  copyBtn: {
    background: "rgba(255,215,0,0.15)", border: "1px solid rgba(255,215,0,0.35)",
    borderRadius: "8px", color: "#FFD700",
    fontSize: "12px", fontWeight: 800, padding: "6px 14px",
    cursor: "pointer", flexShrink: 0,
  },
  codeNote: { color: "rgba(255,255,255,0.3)", fontSize: "11px", margin: 0, lineHeight: 1.4 },
  discountShopBtn: {
    width: "100%",
    background: "linear-gradient(135deg, #B8860B 0%, #FFD700 100%)",
    border: "none", borderRadius: "100px",
    color: "#1A1400", fontSize: "14px", fontWeight: 900,
    padding: "15px 20px", cursor: "pointer",
    boxShadow: "0 4px 20px rgba(255,215,0,0.3)",
  },

  sectionLabel: {
    color: "rgba(255,255,255,0.3)", fontSize: "11px", fontWeight: 800,
    letterSpacing: "2px", textTransform: "uppercase", margin: "4px 0 0",
  },

  // Product Grid
  productGrid: {
    display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px",
  },
  productCard: {
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "16px", overflow: "hidden",
    display: "flex", flexDirection: "column",
  },
  productImage: {
    height: "110px", position: "relative",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  productEmoji: {
    fontSize: "48px", lineHeight: 1,
    position: "relative", zIndex: 1,
    filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.4))",
  },
  productImageOverlay: {
    position: "absolute", inset: 0, opacity: 0.3,
  },
  productBody: {
    padding: "12px 12px 14px",
    display: "flex", flexDirection: "column", gap: "4px", flex: 1,
  },
  productName: {
    color: "#fff", fontSize: "13px", fontWeight: 800,
    margin: 0, lineHeight: 1.3,
  },
  productTagline: {
    color: "rgba(255,255,255,0.45)", fontSize: "11px",
    margin: "0 0 8px", lineHeight: 1.4, flex: 1,
  },
  shopNowBtn: {
    width: "100%", background: "var(--color-primary)",
    border: "none", borderRadius: "100px",
    color: "#fff", fontSize: "12px", fontWeight: 800,
    padding: "9px 12px", cursor: "pointer",
  },

  allProductsBtn: {
    width: "100%",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: "100px", color: "rgba(255,255,255,0.7)",
    fontSize: "13px", fontWeight: 700, padding: "14px 20px",
    cursor: "pointer",
  },

  disclaimer: {
    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: "14px", padding: "12px 14px",
  },
  disclaimerText: {
    color: "rgba(255,255,255,0.25)", fontSize: "11px",
    lineHeight: 1.6, margin: 0,
  },

  // Nav
  bottomNav: {
    display: "flex", borderTop: "1px solid rgba(255,255,255,0.1)",
    background: "var(--color-bg)", padding: "10px 0 18px", flexShrink: 0,
  },
  navBtn: {
    flex: 1, background: "transparent", border: "none",
    color: "rgba(255,255,255,0.4)", display: "flex", flexDirection: "column",
    alignItems: "center", gap: "3px", cursor: "pointer",
    fontSize: "16px", padding: "4px 0",
  },
  navBtnActive: { color: "var(--color-accent)" },
  navLabel: { fontSize: "8px", fontWeight: 600 },
};
