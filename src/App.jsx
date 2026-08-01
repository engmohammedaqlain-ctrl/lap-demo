/**
 * App.jsx — القشرة العليا: تبديل بسيط بين الشاشة الرئيسية والتجربتين
 * (الطفو / الأس الهيدروجيني) عبر حالة عرض واحدة، بلا مكتبة توجيه خارجية
 * (أبسط وأخف للعمل دون اتصال). الحالة تُزامَن مع hash المتصفح ليعمل زر
 * "رجوع" في المتصفح ويمكن مشاركة رابط تجربة مباشرة.
 */
import { useEffect, useState } from "react";
import LoadingScreen from "./LoadingScreen.jsx";
import HomeScreen from "./HomeScreen.jsx";
import BuoyancyApp from "./BuoyancyApp.jsx";
import PhApp from "./ph/PhApp.jsx";
import StaticApp from "./static/StaticApp.jsx";
import ColorApp from "./color/ColorApp.jsx";
import CellApp from "./cell/CellApp.jsx";

const ROUTES = new Set(["buoyancy", "ph", "static", "color", "cell"]);

function viewFromHash() {
  const h = window.location.hash.replace(/^#\/?/, "");
  return ROUTES.has(h) ? h : "home";
}

export default function App() {
  const [view, setView] = useState(viewFromHash);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    const onHashChange = () => setView(viewFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  function open(key) {
    window.location.hash = `/${key}`;
    setView(key);
  }
  function home() {
    window.location.hash = "";
    setView("home");
  }

  if (booting) return <LoadingScreen onDone={() => setBooting(false)} />;

  if (view === "buoyancy") return <BuoyancyApp onHome={home} />;
  if (view === "ph") return <PhApp onHome={home} />;
  if (view === "static") return <StaticApp onHome={home} />;
  if (view === "color") return <ColorApp onHome={home} />;
  if (view === "cell") return <CellApp onHome={home} />;
  return <HomeScreen onOpen={open} />;
}
