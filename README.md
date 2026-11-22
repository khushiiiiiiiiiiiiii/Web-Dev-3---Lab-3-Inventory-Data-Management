# Assignment 3: Inventory and Data Management System

**Course:** Web Dev III  
**Unit:** 3  
**Technology:** Node.js, Express.js, MongoDB, Mongoose and dotenv

## 1. Project overview

This REST API manages a store or warehouse product catalogue. It supports product creation, reading, updating and deletion, stock adjustments, filtering, sorting, pagination, low-stock reporting and category-wise inventory summaries.

## 2. Requirements

- Node.js (LTS version)
- MongoDB running locally, or a MongoDB Atlas connection string
- Postman (for API testing)

## 3. Installation and setup

1. Extract the ZIP file and open this folder in VS Code.
2. Open a terminal in the project folder.
3. Install dependencies:

   ```bash
   npm install
   ```

4. Copy `.env.example` to a new file named `.env`.
5. Check the MongoDB connection string in `.env`. The default is:

   ```env
   PORT=5000
   MONGODB_URI=mongodb://127.0.0.1:27017/inventory_management
   ```

   If using MongoDB Atlas, replace the value with your own Atlas connection string.

6. Start MongoDB if using a local database.
7. Start the backend:

   ```bash
   npm start
   ```

The server runs at `http://localhost:5000`.

## 4. Product fields

| Field | Type | Validation / purpose |
|---|---|---|
| name | String | Required; minimum 2 characters |
| sku | String | Required, unique, stored uppercase |
| category | String | Required |
| price | Number | Required; zero or greater |
| quantity | Number | Required; non-negative whole number |
| reorderLevel | Number | Required; non-negative whole number |
| supplier | String | Required |

The `stockValue` virtual field is calculated as `price * quantity`. Mongoose timestamps automatically add `createdAt` and `updatedAt`.

## 5. API endpoints

Base URL: `http://localhost:5000/api/products`

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/` | Create product |
| GET | `/` | List products |
| GET | `/:id` | Get one product |
| PUT | `/:id` | Update product |
| PATCH | `/:id/stock` | Adjust stock |
| DELETE | `/:id` | Delete product |
| GET | `/low-stock` | Low-stock report |
| GET | `/summary` | Category-wise aggregation |

### Create product

**POST** `/api/products`

Choose Body → raw → JSON in Postman:

```json
{
  "name": "Gel Pen Pack of 15",
  "sku": "STNY-PN-713",
  "category": "Stationery",
  "price": 120,
  "quantity": 40,
  "reorderLevel": 20,
  "supplier": "Cello Pens"
}
```

### List, filter, sort and paginate

**GET** `/api/products?page=1&limit=10`

Optional query parameters:

- `category=Stationery`
- `search=pen` (searches name, SKU and supplier)
- `minPrice=50`
- `maxPrice=500`
- `sort=price` (ascending)
- `sort=-price` (descending)
- `page=1`
- `limit=10`

Example:

`GET /api/products?category=Stationery&sort=-price&page=1&limit=5`

### Get one product

**GET** `/api/products/PRODUCT_ID`

Replace `PRODUCT_ID` with the `_id` returned when a product is created.

### Update product

**PUT** `/api/products/PRODUCT_ID`

```json
{
  "name": "Gel Pen Pack of 15",
  "price": 140,
  "quantity": 60
}
```

Only supplied allowed fields are updated.

### Adjust stock

**PATCH** `/api/products/PRODUCT_ID/stock`

Add 10 units:

```json
{
  "change": 10
}
```

Subtract 3 units:

```json
{
  "change": -3
}
```

The API rejects an adjustment that would make quantity negative.

### Delete product

**DELETE** `/api/products/PRODUCT_ID`

### Low-stock report

**GET** `/api/products/low-stock`

Returns products whose `quantity` is less than or equal to `reorderLevel`.

### Category-wise summary

**GET** `/api/products/summary`

Uses a MongoDB aggregation pipeline with `$group`, `$sum`, `$avg`, `$multiply`, `$round`, `$sort` and `$project` to calculate:

- Number of products in each category
- Total quantity in each category
- Total stock value in each category
- Average product price in each category

## 6. Error handling

The API uses centralized error middleware. It handles validation errors, invalid MongoDB IDs, duplicate SKU values, missing routes and missing products with appropriate HTTP status codes.

## 7. Suggested testing order

1. Create two or more products using POST.
2. List products using GET.
3. Test category/search/price filters and pagination.
4. Copy a product ID and test GET by ID.
5. Update product details using PUT.
6. Increase and decrease stock using PATCH.
7. Check the low-stock report.
8. Check the category summary.
9. Delete a test product.

## 8. Concepts demonstrated

Mongoose schema design, field-level validation, MongoDB connection, RESTful CRUD, query parameters, filtering, sorting, pagination, aggregation pipelines, stock adjustment, middleware, centralized error handling and dotenv configuration.

## 9. Conclusion

The Inventory and Data Management System provides a backend API for maintaining product records and stock levels. It demonstrates database-driven backend development with Node.js, Express.js and MongoDB.
