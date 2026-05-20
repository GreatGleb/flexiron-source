 const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/mocks/warehouse-stock.ts');
let content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');
const result = [];
let lastCategoryNameLine = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const trimmed = line.trim();
  
  // Track when we see a categoryName line
  if (trimmed.includes('categoryName:')) {
    lastCategoryNameLine = true;
  }
  
  result.push(line);
  
  // After a closing brace that follows a categoryName line, insert auditLog
  if (trimmed === '},' && lastCategoryNameLine) {
    // Remove the '},' we just pushed
    result.pop();
    // Add auditLog before the closing brace
    result.push('    auditLog: [],');
    result.push('  },');
    lastCategoryNameLine = false;
  } else if (trimmed === '},') {
    // Reset the flag if we see a closing brace without categoryName
    lastCategoryNameLine = false;
  }
}

fs.writeFileSync(filePath, result.join('\n'), 'utf8');
console.log('Done! Added auditLog: [] to all stock items.');
