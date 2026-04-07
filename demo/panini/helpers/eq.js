module.exports = function(v1, v2, options) {
  const isMatch = (v1 === v2);

  // ПРОВЕРКА: Если хелпер вызван как блок {{#eq ...}}
  if (options && typeof options.fn === 'function') {
    if (isMatch) {
      return options.fn(this);
    }
    return (typeof options.inverse === 'function') ? options.inverse(this) : '';
  }

  // ПРОВЕРКА: Если хелпер вызван внутри скобок (eq v1 v2)
  // В этом случае мы просто возвращаем результат сравнения
  return isMatch;
};