// Number System Converter
// Supports Binary, Decimal, Octal and Hexadecimal conversions.

function convertNumber(value, fromBase, toBase) {
    value = value.trim();

    if (value === "") {
        return "";
    }

    // Check that the entered number is valid for the selected base
    const validPatterns = {
        2: /^[01]+$/,
        8: /^[0-7]+$/,
        10: /^\d+$/,
        16: /^[0-9a-fA-F]+$/
    };

    if (!validPatterns[fromBase].test(value)) {
        throw new Error("Invalid number for the selected number system.");
    }

    // Convert input to decimal first

    document.getElementById("convertButton").addEventListener("click", function () {
    const input = document.getElementById("numberInput").value;
    const fromBase = parseInt(document.getElementById("fromBase").value);
    const toBase = parseInt(document.getElementById("toBase").value);

    const resultElement = document.getElementById("conversionResult");
    const errorElement = document.getElementById("conversionError");

    try {
        const result = convertNumber(input, fromBase, toBase);

        resultElement.textContent = result;
        errorElement.textContent = "";

    } catch (error) {
        resultElement.textContent = "—";
        errorElement.textContent = error.message;
    }
});
    const decimalValue = parseInt(value, fromBase);

    // Convert decimal value to target base
    return decimalValue.toString(toBase).toUpperCase();
}
