export function replaceArguments(template: string, args: any[]) {
    let rendered = template;
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        const pattern = `\\$\\s*\\{\\s*${arg.name}\\s*\\}`;
        rendered = rendered.replace(new RegExp(pattern, "ig"), arg.val);
    }
    return rendered;
}

export function removeAccents(text: string): string {
    return text
        .normalize('NFD')                 // Separates characters from their accents
        .replace(/[\u0300-\u036f]/g, ''); // Removes the accent marks (combining marks)
};

export function normalizeName(name: string) {
    return removeAccents(name.toLowerCase()).replace(/[^a-z]/g, "_").trim();
}