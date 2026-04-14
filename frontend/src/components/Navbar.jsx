import React, { useEffect, useState } from 'react'
import {navbarStyles} from'../../frontend_img/dummyStyles.js'
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useRef } from 'react';
import { useClerk , Show, UserButton } from '@clerk/react'; 
import logo from '../../frontend_img/public/logo.png';
import { Key, User, X } from 'lucide-react';


const STORAGE_KEY = 'doctorToekn_v1';

const Navbar = () => {
  const [isOpen,setIsOpen] = useState(false);
  const [showNavbar, setShowNavbar]= useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isDoctorLoggedIn, setIsDoctorLoggedIn] = useState(()=>{
    try{
      return Boolean(localStorage.getItem(STORAGE_KEY));
    }catch{
      return false;
    }
  });

  const location = useLocation();
  const navRef = useRef(null);
  const clerk = useClerk();
  const navigate = useNavigate();


  //Hide navbar on scroll down and show on scroll up
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY && currentScrollY > 80) {
        setShowNavbar(false);
      } else {
        setShowNavbar(true);
      }
      setLastScrollY(currentScrollY);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);


  //sync the doctor login state across tabs
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY) {
        setIsDoctorLoggedIn(Boolean(e.newValue));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  //close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isOpen && navRef.current && !navRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);
  
  const navItems=[
    {label:'Home', href:'/'},
    {label: 'Doctors', href:'/doctors'},
    {label: 'Services', href:'/services'},
    {label: 'Appointments', href:'/appointments'},
    {label: 'Contact', href:'/contact'}
  ]

  return (
    <>
      <div className={navbarStyles.navbarBorder}></div>
      <nav ref={navRef} className={`${navbarStyles.navbarContainer} ${
        showNavbar? navbarStyles.navbarVisible: navbarStyles.navbarHidden
      }`}>
        <div className={navbarStyles.contentWrapper}>
          <div className={navbarStyles.flexContainer}>
            {/*LOGO*/ }
            <Link to='/' className={navbarStyles.logoLink}>   
            <div className={navbarStyles.logoContainer}>
              <div className={navbarStyles.logoImageWrapper}>
                <img src={logo} alt="Logo" className={navbarStyles.logoImage} />
              </div>
              <div className={navbarStyles.logoTextContainer}>
                <h1 className={navbarStyles.logoTitle
                }>
                  MediCare
                </h1>
                <p className={navbarStyles.logoSubtitle}>HealthCare Solutions</p>
              </div>
            </div>
            </Link>
            <div className={navbarStyles.desktopNav}>
              <div className={navbarStyles.navItemsContainer}>
                {navItems.map((item)=> {
              const isActive = location.pathname ==  item.href;
              return (
                <Link key={item.href} to={item.href} className={`${navbarStyles.navItem} ${isActive? navbarStyles.navItemActive: navbarStyles.navItemInactive}`}>
                  {item.label}
                </Link>
              )
            })}
            </div>
            </div>
            {/*right side*/}
            <div className={navbarStyles.rightContainer}>
              <Show when="signed-out">
                <Link to= '/doctor-admin/login' className={navbarStyles.doctorAdminButton}></Link>
                <User className={navbarStyles.doctorAdminIcon}/>
                <span className={navbarStyles.doctorAdminText}>Doctor Admin</span>
              
                {/* patient login*/}
                <button onClick={()=> clerk.openSignIn()}
                className={navbarStyles.loginButton}>
                  <Key className={navbarStyles.loginButton}/>
                  </button>
                </Show>
                <Show when="signed-in">
                  <UserButton afterSignOutUrl='/'/>
                </Show>
                {/*toggle button*/}
                <button onClick={()=>setIsOpen(!isOpen)} className={navbarStyles.mobileToggle}>
                  {isOpen?( 
                  <X className={navbarStyles.toggleIcon}/>
                  )
                  : (<X className={navbarStyles.toggleIcon}/>)}
                </button>
            </div>
          </div>

          {/*mobile menu*/}
          {isOpen &&(
            <div className={navbarStyles.mobileMenu}>
              {navItems.map((item,idx)=>{
                const isActive = location.pathname ==  item.href;
                return (
                  <Link key={idx} to={item.href} 
                  onClick={()=> setIsOpen(false)}
                  className={`${navbarStyles.mobileMenuItem} ${isActive? navbarStyles.mobileMenuItemActive: navbarStyles.mobileMenuItemInactive}`}>
                    {item.label}
                  </Link>
                )
              })}
              <Show when="signed-out">
                <Link to= '/doctor-admin/login' className={navbarStyles.mobileDoctorAdminButton} onClick={()=>setIsOpen(false)}>
                Doctor Admin
                </Link>   
                <div className={navbarStyles.mobileLoginContainer}>
                  <button onClick={()=> {
                    clerk.openSignIn();}} className={navbarStyles.mobileLoginButton}>Login</button>
                    </div>
                </Show>
                </div>
              )}
        </div>

        <style>{navbarStyles.animationStyles}</style>
      </nav>
    </>
  );
}

export default Navbar