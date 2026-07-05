
export function toSubscript(text){
    text = String(text);

    let subscript = "";

    for(const char of text){
        subscript += charSub(char);
    }

    return subscript;
}

function charSub(char){
    if(char === "0"){
        return "₀";
    }
    if(char === "1"){
        return "₁";
    }
    if(char === "2"){
        return "₂";
    }
    if(char === "3"){
        return "₃";
    }
    if(char === "4"){
        return "₄";
    }
    if(char === "5"){
        return "₅";
    }
    if(char === "6"){
        return "₆";
    }
    if(char === "7"){
        return "₇";
    }
    if(char === "8"){
        return "₈";
    }
    if(char === "9"){
        return "₉";
    }
    if(char === "-"){
        return "₋";
    }
    if(char === "+"){
        return "₊";
    }
    if(char === "="){
        return "₌";
    }
    if(char === "("){
        return "₍";
    }
    if(char === ")"){
        return "₎";
    }

    return char;
}

export function toSuperscript(text){
    text = String(text);

    let superscript = "";

    for(const char of text){
        superscript += charSup(char);
    }

    return superscript;
}

function charSup(char){
    if(char === "a"){
        return "ᵃ";
    }
    if(char === "b"){
        return "ᵇ";
    }
    if(char === "c"){
        return "ᶜ";
    }
    if(char === "d"){
        return "ᵈ";
    }
    if(char === "e"){
        return "ᵉ";
    }
    if(char === "f"){
        return "ᶠ";
    }
    if(char === "g"){
        return "ᵍ";
    }
    if(char === "h"){
        return "ʰ";
    }
    if(char === "i"){
        return "ᶦ";
    }
    if(char === "j"){
        return "ʲ";
    }
    if(char === "k"){
        return "ᵏ";
    }
    if(char === "l"){
        return "ˡ";
    }
    if(char === "m"){
        return "ᵐ";
    }
    if(char === "n"){
        return "ⁿ";
    }
    if(char === "o"){
        return "ᵒ";
    }
    if(char === "p"){
        return "ᵖ";
    }
    if(char === "q"){
        return "ᵠ";
    }
    if(char === "r"){
        return "ʳ";
    }
    if(char === "s"){
        return "ˢ";
    }
    if(char === "t"){
        return "ᵗ";
    }
    if(char === "u"){
        return "ᵘ";
    }
    if(char === "v"){
        return "ᵛ";
    }
    if(char === "w"){
        return "ʷ";
    }
    if(char === "x"){
        return "ˣ";
    }
    if(char === "y"){
        return "ʸ";
    }
    if(char === "z"){
        return "ᶻ";
    }
    if(char === "0"){
        return "⁰";
    }
    if(char === "1"){
        return "¹";
    }
    if(char === "2"){
        return "²";
    }
    if(char === "3"){
        return "³";
    }
    if(char === "4"){
        return "⁴";
    }
    if(char === "5"){
        return "⁵";
    }
    if(char === "6"){
        return "⁶";
    }
    if(char === "7"){
        return "⁷";
    }
    if(char === "8"){
        return "⁸";
    }
    if(char === "9"){
        return "⁹";
    }
    if(char === "-"){
        return "⁻";
    }
    if(char === "+"){
        return "⁺";
    }
    if(char === "="){
        return "⁼";
    }
    if(char === "("){
        return "⁽";
    }
    if(char === ")"){
        return "⁾";
    }

    return char;
}