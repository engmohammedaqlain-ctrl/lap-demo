/**
 * App.jsx — القشرة العليا: تبديل بسيط بين الشاشة الرئيسية والتجربتين
 * (الطفو / الأس الهيدروجيني) عبر حالة عرض واحدة، بلا مكتبة توجيه خارجية
 * (أبسط وأخف للعمل دون اتصال). الحالة تُزامَن مع hash المتصفح ليعمل زر
 * "رجوع" في المتصفح ويمكن مشاركة رابط تجربة مباشرة.
 */
import { Suspense, lazy, useEffect, useState } from "react";
import HomeScreen from "./HomeScreen.jsx";
const BuoyancyApp = lazy(() => import("./BuoyancyApp.jsx"));
const PhApp = lazy(() => import("./ph/PhApp.jsx"));
const StaticApp = lazy(() => import("./static/StaticApp.jsx"));
const ColorApp = lazy(() => import("./color/ColorApp.jsx"));
const CellApp = lazy(() => import("./cell/CellApp.jsx"));

import { RotatePrompt } from "./mobile/GameChrome.jsx";
import { enterGame, leaveGame, useDevice, useWakeLock } from "./mobile/device.js";
const ROUTES = new Set(["buoyancy", "ph", "static", "color", "cell"]);
// تجارب مركّبة بالعرض: على الجوال الطولي نطلب تدوير الجهاز
const LANDSCAPE_ONLY = new Set(["buoyancy", "ph", "static", "color", "cell"]);

function viewFromHash() {
  const h = window.location.hash.replace(/^#\/?/, "");
  return ROUTES.has(h) ? h : "home";
}

export default function App() {
  const [view, setView] = useState(viewFromHash);
  const { phone, landscape } = useDevice();
  const [portraitOk, setPortraitOk] = useState(false);
  useWakeLock(view !== "home");

  useEffect(() => {
    const onHashChange = () => setView(viewFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  function open(key) {
    enterGame({ landscape: LANDSCAPE_ONLY.has(key) });
    window.location.hash = `/${key}`;
    setView(key);
  }
  function home() {
    leaveGame();
    window.location.hash = "";
    setView("home");
  }

  const screens = {
    buoyancy: <BuoyancyApp onHome={home} />,
    ph: <PhApp onHome={home} />,
    static: <StaticApp onHome={home} />,
    color: <ColorApp onHome={home} />,
    cell: <CellApp onHome={home} />,
  };
  const needRotate = phone && !landscape && LANDSCAPE_ONLY.has(view) && !portraitOk;

  return (
    <>
      <Suspense fallback={<div className="app-loading" />}>{screens[view] || <HomeScreen onOpen={open} />}</Suspense>
      {needRotate && <RotatePrompt onDismiss={() => setPortraitOk(true)} />}
    </>
  );
}
