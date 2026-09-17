// Number System Converter

function convertNumber(value, fromBase, toBase) {
    value = value.trim();

    if (value === "") {
        throw new Error("Please enter a number.");
    }

    const validPatterns = {
        2: /^[01]+$/,
        8: /^[0-7]+$/,
        10: /^\d+$/,
        16: /^[0-9a-fA-F]+$/
    };

    if (!validPatterns[fromBase].test(value)) {
        throw new Error("Invalid number for the selected number system.");
    }

    const decimalValue = parseInt(value, fromBase);

    if (!Number.isFinite(decimalValue)) {
        throw new Error("Invalid number.");
    }

    return decimalValue.toString(toBase).toUpperCase();
}


// Connect the Convert button
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


// Copy result
document.getElementById("copyResultButton").addEventListener("click", function () {

    const result = document.getElementById("conversionResult").textContent;

    if (result && result !== "—") {
        navigator.clipboard.writeText(result);
    }

});
