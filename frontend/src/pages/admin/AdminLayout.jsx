import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import NotificationBell from "../../components/NotificationBell";
import LanguageSelector from "../../components/LanguageSelector";
import LogoutButton from "../../components/LogoutButton";
import Logo from "../../components/Logo";
import { listRepairs, listTechnicians, listCustomers } from "../../services/adminService";

export default function AdminLayout({ children, onOpenAddTechnician }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState({ repairs: [], technicians: [], customers: [] });
  const [searchLoading, setSearchLoading] = useState(false);
  const [allData, setAllData] = useState({ repairs: [], technicians: [], customers: [] });
  const searchRef = useRef(null);

  useEffect(() => {
    Promise.all([
      listRepairs().catch(() => ({ repairs: [] })),
      listTechnicians().catch(() => ({ technicians: [] })),
      listCustomers().catch(() => ({ customers: [] })),
    ]).then(([repData, techData, custData]) => {
      setAllData({
        repairs: repData.repairs || [],
        technicians: techData.technicians || [],
        customers: custData.customers || [],
      });
    });
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setIsSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearchChange = (e) => {
    const q = e.target.value;
    setSearchQuery(q);
    if (!q.trim()) {
      setSearchResults({ repairs: [], technicians: [], customers: [] });
      setIsSearchOpen(false);
      return;
    }
    setIsSearchOpen(true);
    setSearchLoading(true);

    const lowerQ = q.toLowerCase();

    const matchingRepairs = (allData.repairs || []).filter((r) => {
      const idMatch = String(r.id).includes(lowerQ);
      const devMatch = String(r.device_category || "").toLowerCase().includes(lowerQ);
      const custMatch = String(r.customer_name || "").toLowerCase().includes(lowerQ);
      const statusMatch = String(r.status || "").toLowerCase().includes(lowerQ);
      return idMatch || devMatch || custMatch || statusMatch;
    });

    const matchingTechnicians = (allData.technicians || []).filter((tech) => {
      const nameMatch = String(tech.name || "").toLowerCase().includes(lowerQ);
      const emailMatch = String(tech.email || "").toLowerCase().includes(lowerQ);
      const areaMatch = String(tech.service_area || "").toLowerCase().includes(lowerQ);
      return nameMatch || emailMatch || areaMatch;
    });

    const matchingCustomers = (allData.customers || []).filter((cust) => {
      const nameMatch = String(cust.name || "").toLowerCase().includes(lowerQ);
      const emailMatch = String(cust.email || "").toLowerCase().includes(lowerQ);
      const phoneMatch = String(cust.phone || "").toLowerCase().includes(lowerQ);
      return nameMatch || emailMatch || phoneMatch;
    });

    setSearchResults({
      repairs: matchingRepairs.slice(0, 5),
      technicians: matchingTechnicians.slice(0, 5),
      customers: matchingCustomers.slice(0, 5),
    });
    setSearchLoading(false);
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const navLinks = [
    { to: "/admin/dashboard", label: t("nav.dashboard"), exact: true },
    { to: "/admin/requests", label: t("nav.repair_requests") },
    { to: "/admin/technicians", label: t("nav.technicians") },
    { to: "/admin/customers", label: t("nav.customers") },
  ];


  const isActiveLink = (link) => {
    if (link.exact) return location.pathname === link.to;
    return location.pathname.startsWith(link.to);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col font-sans">
      {/* TOP NAVIGATION BAR */}
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white shadow-2xs">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          
          {/* BRAND LOGO & LINKS */}
          <div className="flex items-center gap-8">
            <Link to="/admin/dashboard" className="flex items-center gap-2.5 group">
              <Logo size="md" />
              <div className="flex flex-col">
                <span className="font-bold text-lg text-slate-900 tracking-tight leading-none">
                  {t("common.app_name")}
                </span>
                <span className="text-[10px] font-bold text-purple-600 tracking-wider uppercase mt-0.5">
                  {t("common.admin_console")}
                </span>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-1.5">
              {navLinks.map((link) => {
                const active = isActiveLink(link);
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all ${
                      active
                        ? "bg-blue-600 text-white shadow-md shadow-blue-600/15"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* RIGHT SIDE CONTROLS */}
          <div className="hidden sm:flex items-center gap-4">
            
            {/* Global Search Bar */}
            <div className="relative w-64 lg:w-80" ref={searchRef}>
              <div className="relative flex items-center">
                <svg
                  className="pointer-events-none absolute left-3 h-4 w-4 text-ink-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  onFocus={() => searchQuery.trim() && setIsSearchOpen(true)}
                  placeholder={t("common.search_placeholder")}
                  className="w-full rounded-md border border-ink-200 bg-white py-1.5 pl-9 pr-4 text-sm text-ink-800 placeholder-ink-400 focus:border-ink-400 focus:outline-none focus:ring-1 focus:ring-ink-200 transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setIsSearchOpen(false);
                    }}
                    className="absolute right-2 text-ink-400 hover:text-ink-700"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Search Results Dropdown */}
              {isSearchOpen && (
                <div className="absolute right-0 top-full mt-2 w-96 rounded-xl border border-ink-100 bg-white p-3 shadow-xl z-50 max-h-96 overflow-y-auto">
                  {searchLoading ? (
                    <p className="p-3 text-xs text-ink-400 text-center">{t("common.loading")}</p>
                  ) : searchResults.repairs.length === 0 && searchResults.technicians.length === 0 && searchResults.customers.length === 0 ? (
                    <p className="p-3 text-xs text-ink-400 text-center">{t("common.no_data")}</p>
                  ) : (
                    <div className="space-y-3">
                      {searchResults.customers.length > 0 && (
                        <div>
                          <p className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            {t("admin.customers")}
                          </p>
                          {searchResults.customers.map((cust) => (
                            <Link
                              key={cust.id}
                              to={`/admin/customers/${cust.id}`}
                              onClick={() => setIsSearchOpen(false)}
                              className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors"
                            >
                              <div className="flex flex-col">
                                <span className="text-xs font-bold text-slate-900">
                                  {cust.name}
                                </span>
                                <span className="text-[11px] text-slate-500">
                                  {cust.email} • {cust.phone || "No phone"}
                                </span>
                              </div>
                            </Link>
                          ))}
                        </div>
                      )}

                      {searchResults.repairs.length > 0 && (
                        <div>
                          <p className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            {t("admin.repair_requests")}
                          </p>
                          {searchResults.repairs.map((r) => (
                            <Link
                              key={r.id}
                              to={`/admin/requests/${r.id}`}
                              onClick={() => setIsSearchOpen(false)}
                              className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors"
                            >
                              <div className="flex flex-col">
                                <span className="text-xs font-bold text-slate-900">
                                  #{r.id} — {r.device_category || "Repair"}
                                </span>
                                <span className="text-[11px] text-slate-500">
                                  {r.customer_name || "Customer"}
                                </span>
                              </div>
                              <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-blue-50 text-blue-700">
                                {r.status}
                              </span>
                            </Link>
                          ))}
                        </div>
                      )}

                      {searchResults.technicians.length > 0 && (
                        <div>
                          <p className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            {t("admin.technicians")}
                          </p>
                          {searchResults.technicians.map((tech) => (
                            <Link
                              key={tech.id}
                              to="/admin/technicians"
                              onClick={() => setIsSearchOpen(false)}
                              className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors"
                            >
                              <div className="flex flex-col">
                                <span className="text-xs font-bold text-slate-900">
                                  {tech.name}
                                </span>
                                <span className="text-[11px] text-slate-500">
                                  {tech.service_area || tech.email}
                                </span>
                              </div>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <LanguageSelector />

            {/* Notification Bell Icon */}
            <div className="relative text-ink-600 hover:text-ink-800">
              <NotificationBell role="ADMIN" />
            </div>

            {/* Admin User Badge */}
            <div className="flex items-center gap-2 pl-2 border-l border-ink-100">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-100 border border-ink-200 text-xs font-bold text-ink-800">
                {user?.name ? user.name.charAt(0).toUpperCase() : "A"}
              </div>
              <div className="hidden lg:flex flex-col text-left">
                <span className="text-xs font-semibold text-ink-800 leading-tight">
                  {user?.name || "Admin"}
                </span>
                <span className="text-[10px] text-slate-500">{t("common.admin_console")}</span>
              </div>
            </div>

            <LogoutButton onLogout={handleLogout} />
          </div>

          {/* Mobile Hamburger Toggle */}
          <button
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="md:hidden flex h-9 w-9 items-center justify-center rounded-md border border-ink-200 bg-white text-ink-600 hover:text-ink-800"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Dropdown Nav Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-ink-100 bg-white p-4 space-y-3 shadow-md">
            <div className="flex justify-between items-center mb-2">
              <LanguageSelector />
            </div>
            <div className="relative mb-3">
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder={t("common.search_placeholder")}
                className="w-full rounded-md border border-ink-200 bg-white py-2 pl-9 pr-4 text-sm text-ink-800"
              />
              <svg
                className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-ink-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <nav className="flex flex-col space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.label}
                  to={link.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-3 py-2 text-sm font-medium rounded-md ${
                    isActiveLink(link) ? "bg-ink-800 text-white" : "text-ink-600 hover:bg-ink-100"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        )}
      </header>

      {/* BODY CONTENT CONTAINER */}
      <div className="flex-1 relative flex flex-col">
        <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 pb-12">
          {children}
        </main>
      </div>
    </div>
  );
}
