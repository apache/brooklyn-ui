const KEYS = {
    COMPOSER_QUERY: 'composerQuery',
    SECTION: 'composerSection',
    VIEW_MODE: 'composerViewMode',
}

const getterFor = (storageType, key) => (parseAsJSON=false) => {
    let result;
    try {
        result = parseAsJSON
            ? JSON.parse(storageType.getItem(key))
            : storageType.getItem(key);
    } catch (err) {
        result = undefined;
    }
    return result;
}

const setterFor = (storageType, key) => (newValue, isJSON) =>
    storageType.setItem(key, isJSON ? JSON.stringify(newValue) : newValue)

const storageFor = (storageType) => ({
    getComposerViewMode: getterFor(storageType, KEYS.VIEW_MODE),
    setComposerViewMode: setterFor(storageType, KEYS.VIEW_MODE),
    getComposerSection: getterFor(storageType, KEYS.SECTION),
    setComposerSection: setterFor(storageType, KEYS.SECTION),
    getComposerSearch: getterFor(storageType, KEYS.COMPOSER_QUERY),
    setComposerSearch: setterFor(storageType, KEYS.COMPOSER_QUERY),
})

export const session = storageFor(sessionStorage);
export const local = storageFor(localStorage);