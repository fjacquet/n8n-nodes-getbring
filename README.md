# n8n-nodes-getbring

[![npm version](https://img.shields.io/npm/v/@fjacquet/n8n-nodes-getbring)](https://www.npmjs.com/package/@fjacquet/n8n-nodes-getbring)
[![npm downloads](https://img.shields.io/npm/dm/@fjacquet/n8n-nodes-getbring)](https://www.npmjs.com/package/@fjacquet/n8n-nodes-getbring)
[![CI](https://github.com/fjacquet/n8n-nodes-getbring/actions/workflows/ci.yml/badge.svg)](https://github.com/fjacquet/n8n-nodes-getbring/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/@fjacquet/n8n-nodes-getbring)](./LICENSE)
[![node](https://img.shields.io/node/v/@fjacquet/n8n-nodes-getbring)](https://nodejs.org)
[![n8n community node](https://img.shields.io/badge/n8n-community%20node-ff6d5a)](https://docs.n8n.io/integrations/community-nodes/)

An [n8n](https://n8n.io) community node for [Bring!](https://www.getbring.com) shopping lists. List your lists, read their items, add, remove and complete items, and read the article catalog.

Item names are translated to Bring's catalog keys, so an item you add as "Oignons" shows up in the app with its icon instead of as a plain custom item.

This package is a TypeScript port of [miaucl/bring-api](https://github.com/miaucl/bring-api). It has no runtime dependencies.

## Requirements

- n8n with community nodes enabled.
- Node.js 24 or later (set in `engines`).
- A Bring! account with an email address and password.

## Installation

In n8n open **Settings → Community Nodes → Install** and enter:

```
@fjacquet/n8n-nodes-getbring
```

Or, for a self-managed custom-nodes directory:

```bash
npm install @fjacquet/n8n-nodes-getbring
```

## Credential setup

1. In n8n create a credential of type **Bring API**.
2. Enter the **Email** and **Password** of your Bring! account.
3. Click **Test**. It tries to sign in.

The node signs in once per execution and reuses the session for all input items. The password and tokens never appear in node output or error messages.

## Node usage

Add the **Bring!** node, pick the credential, then a resource and an operation.

Every operation that takes a **List** offers three modes: pick from a list, enter the list **ID** (UUID), or enter the list **Name**. A name must match exactly one list. If no list or several lists have that name, the node stops with an error that names the list.

| Resource | Operation | What it does |
|---|---|---|
| List | Get Many | Returns one item per list: `listUuid`, `name`, `theme`. |
| List | Get Items | Returns the items of one list. |
| Item | Add | Adds items to a list. |
| Item | Remove | Removes items from a list. |
| Item | Complete | Marks items as bought; Bring moves them to "recently used". |
| Catalog | Get | Returns the article catalog of a locale. |

### List → Get Many

No parameters. Output per list:

```json
{ "listUuid": "…", "name": "Maison", "theme": "…" }
```

### List → Get Items

- **List**: the list to read.
- **Include Recently Used**: off by default. When on, items from the "recently" section are returned too.

Output per item:

```json
{
  "key": "Zwiebeln",
  "name": "Oignons",
  "specification": "3 pièces",
  "uuid": "…",
  "status": "purchase",
  "listUuid": "…"
}
```

`key` is the Bring catalog key (German). `name` is the display name in the list's language. `status` is `purchase` or `recently`.

### Item → Add, Remove, Complete

Parameters:

- **List**: the target list.
- **Item Name**: the name to add, remove or complete. Required. A blank name makes that item fail.
- **Specification**: optional detail such as a quantity or brand.
- **Item UUID** (Remove and Complete only): target one specific item.
- **Options → Translate Name**: on by default. See [Translation](#translation).

Each input item produces one output item: your input fields plus `key`, `name`, `specification`, `uuid`, `listUuid` and `operation` (`TO_PURCHASE`, `REMOVE` or `TO_RECENTLY`). `uuid` is always present for Add. For Remove and Complete it is present only when you gave an **Item UUID**.

Add generates a UUID for each new item. Remove and Complete without an **Item UUID** act on the newest item with that name, which is how Bring resolves it. Pass the `uuid` returned by Get Items to target an exact item.

All input items for the same list are sent to Bring in one request.

### Catalog → Get

- **Locale Source**: **Fixed Locale** (default) or **From List**.
- **Locale**: one of the 20 supported locales. Used with Fixed Locale. No login is needed in this mode.
- **List**: used with From List. The node reads that list's article language.

Output: one item per article, `{ "key": "Zwiebeln", "name": "Oignons", "locale": "fr-FR" }`.

Use it to feed a validation step or an AI agent with the exact names Bring knows. The node can also be used as a tool by AI Agent nodes.

### Example: Paprika shopping list to Bring

Take the ingredients from a Paprika-style shopping list (one item per ingredient, with a `name` field) and add them to the list "Maison". Paste this into the n8n canvas; the first node is a placeholder for your own source.

```json
{
  "nodes": [
    {
      "parameters": {},
      "name": "Shopping list",
      "type": "n8n-nodes-base.noOp",
      "typeVersion": 1,
      "position": [0, 0]
    },
    {
      "parameters": {
        "resource": "item",
        "operation": "add",
        "list": { "__rl": true, "mode": "name", "value": "Maison" },
        "itemName": "={{ $json.name }}",
        "specification": "={{ $json.quantity }}"
      },
      "name": "Bring!",
      "type": "@fjacquet/n8n-nodes-getbring.bring",
      "typeVersion": 1,
      "position": [220, 0]
    }
  ],
  "connections": {
    "Shopping list": { "main": [[{ "node": "Bring!", "type": "main", "index": 0 }]] }
  }
}
```

"Maison" is a French-language list, so "Oignons" becomes the key `Zwiebeln` and gets its icon. After you attach your credential, adjust the field names (`name`, `quantity`) to match your source.

## Translation

Bring stores items under German catalog keys (`Zwiebeln`). The app shows them in the language of the list. The node translates in both directions using the list's article language, read from your Bring settings. If a list has no language setting, the account language is used.

Adding an item (**Translate Name** on):

1. The name is trimmed.
2. It is matched exactly against the catalog names of the list's language.
3. If that fails, it is matched case-insensitively. "  OIGNONS " finds `Zwiebeln`.
4. If that fails, it is matched against the German keys.
5. If nothing matches, the name is sent as written and becomes a **custom item** without an icon.

If two catalog entries share one display name, the last one in the catalog wins, as in bring-api.

There is no fuzzy or plural matching. "Oignon" does not match "Oignons". Use the **Catalog → Get** operation to list the exact names, for example to validate input or to give an AI agent the allowed values.

Turn **Translate Name** off to send the name as written. Lists in German (Switzerland, `de-CH`) are never translated, because the catalog keys are already German there.

If the account locale is not one of the 20 supported locales (for example `fr-BE`), the node falls back to the default for that language (`fr-FR`). For an unknown language it uses `de-CH` and does no translation.

Get Items translates the other way: the Bring key becomes `name`, and the original key stays in `key`. Keys with no catalog entry (custom items) are returned unchanged.

## Error handling

Errors surface as n8n node errors. A wrong password gives `Bring login failed: invalid email or password`. The response body is never echoed.

Use the node setting **Continue On Fail** to get `{ "error": "<message>" }` items instead of stopping the workflow.

For Item operations:

- A failed login always stops the node, even with Continue On Fail, because the node signs in before it processes any item.
- The node plans all input items before it writes anything. Without Continue On Fail, one invalid item (blank name, unknown or ambiguous list) stops the node and nothing is written.
- With Continue On Fail, invalid items become error items and the rest of the batch is still sent.
- Lists are written one after another. If an item sends to several lists and a later list fails, the earlier lists stay written. A failed list gives error items for its inputs only.

## Development

```bash
npm install
npm test            # vitest
npm run lint        # biome + n8n-node lint
npm run typecheck   # tsc, sources and tests
npm run build       # n8n-node build → dist/
npm run dev         # local n8n with this node loaded (needs Docker or Podman)
```

## Credits

This package is a TypeScript port of [miaucl/bring-api](https://github.com/miaucl/bring-api) by Cyrill Raccaud and Manfred Dennerlein Rodelo. The catalog files, locale list, request headers and translation rules come from that project. bring-api in turn builds on earlier work by Elias Ball.

## Disclaimer

The developers of this module are in no way endorsed by or affiliated with Bring! Labs AG, or any associated subsidiaries, logos or trademarks.

## License

[MIT](./LICENSE). The license keeps the copyright lines of the bring-api authors.

## Links

- [bring-api](https://github.com/miaucl/bring-api)
- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [Issues](https://github.com/fjacquet/n8n-nodes-getbring/issues)
