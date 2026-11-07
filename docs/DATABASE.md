# Database

## User

Stores user accounts.

Relationships

User
├── Collection
├── CollectionItem
└── Item

---

## Item

Stores every catalog item.

Relationships

Item
├── ItemPrice
├── CollectionItem
└── CatalogCollection

---

## ItemPrice

Stores historical market prices.