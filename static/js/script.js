  const hamburger = document.getElementById("hamburger");
  const navbar = document.getElementById("navbar");
  const links = document.querySelectorAll(".navbar a");
  const logo1 = document.querySelector(".logo1");

  // Toggle navbar
  hamburger.addEventListener("click", () => {
    navbar.classList.toggle("show");
    hamburger.classList.toggle("active");
    logo1.classList.toggle("hide-logo");
  });

  // Highlight active link on scroll
  window.addEventListener("scroll", () => {
    let fromTop = window.scrollY + 60; // Offset for fixed header
    links.forEach(link => {
      const section = document.querySelector(link.getAttribute("href"));
      if (
        section &&
        section.offsetTop <= fromTop &&
        section.offsetTop + section.offsetHeight > fromTop
      ) {
        links.forEach(l => l.classList.remove("active"));
        link.classList.add("active");
      }
    });
  });

const testimonials = document.querySelectorAll('.test');
const prevBtn = document.getElementById('prevTestimonial');
const nextBtn = document.getElementById('nextTestimonial');
const dotsContainer = document.getElementById('testimonialDots');

let current = 0;
let autoSlideInterval;

function showTestimonial(index) {
  current = index;
  testimonials.forEach((test, i) => {
    test.classList.toggle('active', i === index);
    dotsContainer.children[i].classList.toggle('active', i === index);
  });
}

function createDots() {
  testimonials.forEach((_, i) => {
    const dot = document.createElement('span');
    dot.addEventListener('click', () => {
      resetAutoSlide();
      showTestimonial(i);
    });
    dotsContainer.appendChild(dot);
  });
}

function nextTestimonial() {
  showTestimonial((current + 1) % testimonials.length);
}

function prevTestimonialFunc() {
  showTestimonial((current - 1 + testimonials.length) % testimonials.length);
}

function resetAutoSlide() {
  clearInterval(autoSlideInterval);
  autoSlideInterval = setInterval(nextTestimonial, 5000);
}

// Initialize
createDots();
showTestimonial(current);
autoSlideInterval = setInterval(nextTestimonial, 5000);

prevBtn.addEventListener('click', () => {
  prevTestimonialFunc();
  resetAutoSlide();
});

nextBtn.addEventListener('click', () => {
  nextTestimonial();
  resetAutoSlide();
});