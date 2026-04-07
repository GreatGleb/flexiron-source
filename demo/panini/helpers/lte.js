module.exports = function(v1, v2, options) {
  const result = v1 <= v2;
  
  if (options && typeof options.fn === 'function') {
    if (result) {
      return options.fn(this);
    }
    return (typeof options.inverse === 'function') ? options.inverse(this) : '';
  }
  
  return result;
};
