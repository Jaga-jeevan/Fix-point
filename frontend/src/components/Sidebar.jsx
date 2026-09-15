import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";

const LINKS = {
  CUSTOMER: [
    { to: "/customer/dashboard", key: "nav.dashboard" },
    { to: "/customer/repairs", key: "nav.my_repairs" },
    { to: "/customer/repairs/new", key: "nav.new_repair" },
  ],
  TECHNICIAN: [{ to: "/technician/dashboard", key: "nav.my_jobs" }],
  ADMIN: [
    { to: "/admin/dashboard", key: "nav.dashboard" },
    { to: "/admin/requests", key: "nav.repair_requests" },
    { to: "/admin/technicians", key: "nav.technicians" },
  ],
};

const ICONS = {
  "nav.dashboard": (
    <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  "nav.my_repairs": (
    <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  "nav.new_repair": (
    <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
    </svg>
  ),
  "nav.my_jobs": (
    <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  "nav.repair_requests": (
    <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  ),
  "nav.technicians": (
    <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
};

export default function Sidebar() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();

  if (!user) return null;
  const links = LINKS[user.role] || [];
  const isCustomer = user.role === "CUSTOMER";

  const isCustomerLinkActive = (linkTo) => {
    const currentPath = location.pathname;
    if (linkTo === "/customer/repairs/new") {
      return currentPath === "/customer/repairs/new";
    }
    if (linkTo === "/customer/repairs") {
      return (
        currentPath === "/customer/repairs" ||
        (currentPath.startsWith("/customer/repairs/") && currentPath !== "/customer/repairs/new")
      );
    }
    if (linkTo === "/customer/dashboard") {
      return currentPath === "/customer/dashboard";
    }
    return currentPath === linkTo;
  };

  return (
    <aside className="hidden w-60 flex-shrink-0 border-r border-slate-100 bg-white p-4 md:flex flex-col min-h-[calc(100vh-4rem)] select-none">
      <nav className="w-full space-y-2.5">
        {links.map((link) => (
          <NavLink key={link.to} to={link.to} className="w-full block">
            {({ isActive: defaultIsActive }) => {
              const active = isCustomer
                ? isCustomerLinkActive(link.to)
                : defaultIsActive;

              return (
                <div className="group relative w-full cursor-pointer">
                  {/* 3D Base/Bottom Depth Layer */}
                  <div
                    className={`absolute inset-0 rounded-xl transition-all duration-150 ease-out ${
                      active
                        ? "bg-blue-800 translate-y-1 shadow-sm shadow-blue-900/30"
                        : "bg-slate-200 group-hover:bg-slate-300 translate-y-0.5"
                    }`}
                  />

                  {/* 3D Top Face Layer with Specular Border & Press Animation */}
                  <div
                    className={`relative flex items-center gap-3 w-full rounded-xl px-4 py-2.5 text-xs transition-all duration-150 ease-out ${
                      active
                        ? "bg-gradient-to-b from-blue-500 to-blue-600 text-white font-bold border-t border-white/35 shadow-xs -translate-y-0.5 group-active:translate-y-0.5"
                        : "bg-white text-slate-700 font-semibold border border-slate-200/80 -translate-y-0.5 group-hover:-translate-y-1 group-hover:text-blue-600 group-hover:bg-slate-50 group-active:translate-y-0"
                    }`}
                  >
                    {ICONS[link.key]}
                    <span>{t(link.key)}</span>
                  </div>
                </div>
              );
            }}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
