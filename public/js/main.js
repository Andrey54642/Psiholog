// Интерактив главной страницы: меню, шапка, появление блоков при скролле.
(function () {
  "use strict";

  var burger = document.getElementById("burger");
  var nav = document.getElementById("nav");
  var header = document.querySelector(".header");

  if (burger && nav) {
    burger.addEventListener("click", function () {
      var open = nav.classList.toggle("nav--open");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
      burger.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню");
    });
    nav.addEventListener("click", function (event) {
      if (event.target.tagName === "A") {
        nav.classList.remove("nav--open");
        burger.setAttribute("aria-expanded", "false");
      }
    });
  }

  function onScroll() {
    if (header) header.classList.toggle("header--scrolled", window.scrollY > 8);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  var revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && revealEls.length) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    revealEls.forEach(function (el) { observer.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("in"); });
  }

  var year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());
})();
