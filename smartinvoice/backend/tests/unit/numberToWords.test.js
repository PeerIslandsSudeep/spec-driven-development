const { integerToIndianWords, paiseToWords } = require("../../src/services/numberToWords");

describe("integerToIndianWords", () => {
  test("boundary cases", () => {
    expect(integerToIndianWords(0)).toBe("zero");
    expect(integerToIndianWords(1)).toBe("one");
    expect(integerToIndianWords(19)).toBe("nineteen");
    expect(integerToIndianWords(20)).toBe("twenty");
    expect(integerToIndianWords(99)).toBe("ninety-nine");
    expect(integerToIndianWords(100)).toBe("one hundred");
    expect(integerToIndianWords(999)).toBe("nine hundred ninety-nine");
    expect(integerToIndianWords(1000)).toBe("one thousand");
    expect(integerToIndianWords(99999)).toBe("ninety-nine thousand nine hundred ninety-nine");
    expect(integerToIndianWords(100000)).toBe("one lakh");
    expect(integerToIndianWords(9999999)).toBe("ninety-nine lakh ninety-nine thousand nine hundred ninety-nine");
    expect(integerToIndianWords(10000000)).toBe("one crore");
  });
});

describe("paiseToWords", () => {
  test("basic rupee amount", () => {
    expect(paiseToWords(100)).toBe("One rupees only");
    expect(paiseToWords(100000)).toBe("One thousand rupees only");
  });
  test("rupees + paise", () => {
    expect(paiseToWords(12350)).toBe("One hundred twenty-three rupees and fifty paise only");
  });
  test("big amount with grouping", () => {
    // 18,88,000 paise = ₹18,880.00
    expect(paiseToWords(1888000)).toBe("Eighteen thousand eight hundred eighty rupees only");
  });
});
