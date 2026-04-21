import React from 'react'
import Navbar from '../components/Navbar'
import {heroStyles } from '../assets/dummyStyles'
import logoImg from '../assets/logo.png'

export const Hero = ({role="admin", userName="Doctor"}) => {
  return (
    <div className={heroStyles.container}>
      <Navbar />
    </div>
  )
}

export default Hero