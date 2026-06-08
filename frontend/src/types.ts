export interface Product {
  id: number
  name: string
  price: string
  stock: number
  created_at: string
}

export interface ProductsResponse {
  source: 'cache' | 'db'
  data: Product[]
}
