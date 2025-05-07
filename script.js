// Main initialization
document.addEventListener('DOMContentLoaded', function() {
  // Theme toggle functionality
  const themeToggle = document.getElementById('theme-toggle');
  const htmlElement = document.documentElement;
  const themeIcon = themeToggle.querySelector('i');
  const mainContainer = document.querySelector('.main-container');
  const darkModeContainer = document.querySelector('.dark-mode-container');

  // Check if user has a saved theme preference or use system preference
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
      applyTheme(savedTheme);
  } else {
      // Check system preference
      const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
      applyTheme(prefersDarkScheme.matches ? 'dark' : 'light');

      // Listen for system preference changes
      prefersDarkScheme.addEventListener('change', (e) => {
          if (!localStorage.getItem('theme')) { // Only if user hasn't manually set a preference
              applyTheme(e.matches ? 'dark' : 'light');
          }
      });
  }

  // Toggle theme when button is clicked
  themeToggle.addEventListener('click', function() {
      const currentTheme = htmlElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';

      applyTheme(newTheme);
      localStorage.setItem('theme', newTheme);
  });

  function applyTheme(theme) {
      // Add transition class before changing theme
      document.body.classList.add('theme-transition');

      // Set theme attribute
      htmlElement.setAttribute('data-theme', theme);

      // Update icon
      updateThemeIcon(theme);

      // Toggle visibility of containers based on theme
      if (mainContainer && darkModeContainer) {
        if (theme === 'dark') {
          mainContainer.style.display = 'none';
          darkModeContainer.style.display = 'block';
        } else {
          mainContainer.style.display = 'block';
          darkModeContainer.style.display = 'none';
        }
      }

      // Remove transition class after animation completes
      setTimeout(() => {
          document.body.classList.remove('theme-transition');
      }, 500);
  }

  function updateThemeIcon(theme) {
      if (theme === 'light') {
          themeIcon.classList.remove('fa-moon');
          themeIcon.classList.add('fa-sun');
      } else {
          themeIcon.classList.remove('fa-sun');
          themeIcon.classList.add('fa-moon');
      }
  }

  // Active navigation link highlighting
  const navLinks = document.querySelectorAll('.nav-links a');

  function setActiveLink() {
    const scrollPosition = window.scrollY;

    // Get all sections
    const sections = document.querySelectorAll('section[id]');

    sections.forEach(section => {
      const sectionTop = section.offsetTop - 100;
      const sectionHeight = section.offsetHeight;
      const sectionId = section.getAttribute('id');

      if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
        // Remove active class from all links
        navLinks.forEach(link => {
          link.classList.remove('active');
        });

        // Add active class to current section link
        const currentLink = document.querySelector(`.nav-links a[href="#${sectionId}"]`);
        if (currentLink) {
          currentLink.classList.add('active');
        }
      }
    });
  }

  // Set active link on scroll
  window.addEventListener('scroll', setActiveLink);

  // Set active link on page load
  setActiveLink();

  // Typing effect
  const typingText = document.querySelector('.typing-text');
  const words = ["business", "product", "website", "brand"];
  let wordIndex = 0;
  let charIndex = 0;
  let isDeleting = false;
  let isWaiting = false;

  function typeEffect() {
    const currentWord = words[wordIndex];

    if (isDeleting) {
      // Remove a character
      typingText.textContent = currentWord.substring(0, charIndex - 1);
      charIndex--;
    } else {
      // Add a character
      typingText.textContent = currentWord.substring(0, charIndex + 1);
      charIndex++;
    }

    // If word is complete, wait and then delete
    if (!isDeleting && charIndex === currentWord.length) {
      isWaiting = true;
      setTimeout(() => {
        isDeleting = true;
        isWaiting = false;
      }, 1500);
    }

    // If deletion is complete, move to next word
    if (isDeleting && charIndex === 0) {
      isDeleting = false;
      wordIndex = (wordIndex + 1) % words.length;
    }

    // Set typing speed
    let typeSpeed = isDeleting ? 80 : 120;

    // Pause at the end of a word
    if (isWaiting) {
      typeSpeed = 1500;
    }

    setTimeout(typeEffect, typeSpeed);
  }

  // Start typing effect
  if (typingText) {
    typeEffect();
  }
});

// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    e.preventDefault();

    const targetId = this.getAttribute('href');
    const targetElement = document.querySelector(targetId);

    if (targetElement) {
      // Get the height of the navigation bar
      const navHeight = document.querySelector('nav').offsetHeight;

      window.scrollTo({
        top: targetElement.offsetTop - navHeight - 20, // Additional 20px for spacing
        behavior: 'smooth'
      });

      // Update active class
      document.querySelectorAll('.nav-links a').forEach(link => {
        link.classList.remove('active');
      });
      this.classList.add('active');
    }
  });
});

// Mobile menu toggle for light mode
const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
const navLinks = document.getElementById('nav-links');

if (mobileMenuToggle && navLinks) {
  mobileMenuToggle.addEventListener('click', function() {
    // Toggle the display of the navigation links
    if (window.getComputedStyle(navLinks).display === 'none') {
      navLinks.style.display = 'flex';
      navLinks.style.flexDirection = 'column';
      navLinks.style.position = 'absolute';
      navLinks.style.top = '70px';
      navLinks.style.right = '0';
      navLinks.style.backgroundColor = 'var(--white)';
      navLinks.style.padding = '1rem';
      navLinks.style.borderRadius = 'var(--border-radius)';
      navLinks.style.boxShadow = 'var(--box-shadow)';
      navLinks.style.zIndex = '100';
    } else {
      navLinks.style.display = 'none';
    }

    // Change icon based on menu state
    const menuIcon = mobileMenuToggle.querySelector('i');
    if (window.getComputedStyle(navLinks).display !== 'none') {
      menuIcon.classList.remove('fa-bars');
      menuIcon.classList.add('fa-times');
    } else {
      menuIcon.classList.remove('fa-times');
      menuIcon.classList.add('fa-bars');
    }
  });

  // Close mobile menu when clicking on a link
  const navLinksItems = navLinks.querySelectorAll('a');
  navLinksItems.forEach(link => {
    link.addEventListener('click', function() {
      if (window.innerWidth <= 768) {
        navLinks.style.display = 'none';
        const menuIcon = mobileMenuToggle.querySelector('i');
        menuIcon.classList.remove('fa-times');
        menuIcon.classList.add('fa-bars');
      }
    });
  });

  // Close mobile menu when clicking outside
  document.addEventListener('click', function(e) {
    if (window.innerWidth <= 768 &&
        !navLinks.contains(e.target) &&
        !mobileMenuToggle.contains(e.target) &&
        window.getComputedStyle(navLinks).display !== 'none') {
      navLinks.style.display = 'none';
      const menuIcon = mobileMenuToggle.querySelector('i');
      menuIcon.classList.remove('fa-times');
      menuIcon.classList.add('fa-bars');
    }
  });
}

// Mobile menu toggle for dark mode
const darkMobileMenuToggle = document.getElementById('dark-mobile-menu-toggle');
const darkNavLinks = document.getElementById('dark-nav-links');

if (darkMobileMenuToggle && darkNavLinks) {
  darkMobileMenuToggle.addEventListener('click', function() {
    // Toggle active class for dark mode links
    darkNavLinks.classList.toggle('active');

    // Change icon based on menu state
    const menuIcon = darkMobileMenuToggle.querySelector('i');
    if (darkNavLinks.classList.contains('active')) {
      menuIcon.classList.remove('fa-bars');
      menuIcon.classList.add('fa-times');
    } else {
      menuIcon.classList.remove('fa-times');
      menuIcon.classList.add('fa-bars');
    }
  });

  // Close dark mobile menu when clicking on a link
  const darkNavLinksItems = darkNavLinks.querySelectorAll('a');
  darkNavLinksItems.forEach(link => {
    link.addEventListener('click', function() {
      if (window.innerWidth <= 768) {
        darkNavLinks.classList.remove('active');
        const menuIcon = darkMobileMenuToggle.querySelector('i');
        menuIcon.classList.remove('fa-times');
        menuIcon.classList.add('fa-bars');
      }
    });
  });

  // Close dark mobile menu when clicking outside
  document.addEventListener('click', function(e) {
    if (window.innerWidth <= 768 &&
        !darkNavLinks.contains(e.target) &&
        !darkMobileMenuToggle.contains(e.target) &&
        darkNavLinks.classList.contains('active')) {
      darkNavLinks.classList.remove('active');
      const menuIcon = darkMobileMenuToggle.querySelector('i');
      menuIcon.classList.remove('fa-times');
      menuIcon.classList.add('fa-bars');
    }
  });
}

// Form submission
const contactForm = document.getElementById('contact-form');
const formStatus = document.getElementById('form-status');

if (contactForm && formStatus) {
  contactForm.addEventListener('submit', function(e) {
    e.preventDefault();

    // In a real application, you would send the form data to a server
    // This is just a simulation
    formStatus.textContent = 'Message sent successfully!';
    formStatus.style.color = '#0e3b43';

    // Reset form
    contactForm.reset();

    // Clear status message after 3 seconds
    setTimeout(() => {
      formStatus.textContent = '';
    }, 3000);
  });
}

// Button actions for hero buttons
const aboutBtn = document.querySelector('.btn-primary');
const downloadBtn = document.querySelector('.btn-secondary');

if (aboutBtn) {
  aboutBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const aboutSection = document.querySelector('#about');
    if (aboutSection) {
      aboutSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}

if (downloadBtn) {
  downloadBtn.addEventListener('click', (e) => {
    e.preventDefault();
    // In a real application, you would trigger a download here
    console.log('Download CV clicked');
  });
}
