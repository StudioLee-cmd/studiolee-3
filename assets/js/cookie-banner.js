/* The old HighLevel chat is gone from the site (owner 14-11: its account is no longer paid for; a new chat
   on the new account comes later, with its own consent). It was the one part of the site that placed cookies, so there
   is nothing to ask: this script only releases the space a page's head may still reserve for the old question (the html
   class cb-ask, see styles.css), and no chat or other third-party script is loaded. */
(function () {
  document.documentElement.classList.remove('cb-ask');
})();
