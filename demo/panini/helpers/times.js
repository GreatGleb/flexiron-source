module.exports = function(n, options) {
  let result = '';
  for (let i = 1; i <= n; i++) {
    result += options.fn(i);
  }
  return result;
};
