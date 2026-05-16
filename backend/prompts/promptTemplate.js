function renderPromptTemplate(template, replacements) {
  return String(template || '').replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (match, key) => (
    Object.prototype.hasOwnProperty.call(replacements || {}, key)
      ? String(replacements[key] ?? '')
      : match
  ));
}

module.exports = {
  renderPromptTemplate,
};
