import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../database/database.module';
import { REDIS_CLIENT, redisClientRef } from '../cache/cache.module';
import { Product } from './product.entity';

const CACHE_KEY = 'products:all';
const CACHE_TTL = 60;

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @Inject(DATABASE_POOL) private readonly pool: Pool,
    @Inject(REDIS_CLIENT) private readonly redisRef: typeof redisClientRef,
  ) {}

  async findAll(): Promise<{ source: 'cache' | 'db'; data: Product[] }> {
    const redis = this.redisRef.client;

    try {
      if (redis) {
        const cached = await redis.get(CACHE_KEY);
        if (cached) {
          this.logger.log('Cache HIT');
          return { source: 'cache', data: JSON.parse(cached) };
        }
        this.logger.log('Cache MISS');
      }

      const { rows } = await this.pool.query<Product>(
        'SELECT * FROM products ORDER BY id',
      );

      if (redis) {
        await redis.setEx(CACHE_KEY, CACHE_TTL, JSON.stringify(rows));
      }

      return { source: 'db', data: rows };
    } catch (err) {
      this.logger.error('Failed to fetch products', err);
      throw new InternalServerErrorException('Failed to fetch products');
    }
  }

  async findOne(id: number): Promise<Product> {
    try {
      const { rows } = await this.pool.query<Product>(
        'SELECT * FROM products WHERE id = $1',
        [id],
      );
      if (rows.length === 0) {
        throw new NotFoundException('Not found');
      }
      return rows[0];
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      this.logger.error('Failed to fetch product', err);
      throw new InternalServerErrorException('Failed to fetch product');
    }
  }

  async updateStock(id: number, delta: number): Promise<Product> {
    if (typeof delta !== 'number') {
      throw new BadRequestException('delta must be a number');
    }

    try {
      const { rows } = await this.pool.query<Product>(
        `UPDATE products SET stock = GREATEST(0, stock + $1) WHERE id = $2 RETURNING *`,
        [delta, id],
      );

      if (rows.length === 0) {
        throw new NotFoundException('Not found');
      }

      const redis = this.redisRef.client;
      if (redis) {
        await redis.del(CACHE_KEY);
      }

      return rows[0];
    } catch (err) {
      if (
        err instanceof NotFoundException ||
        err instanceof BadRequestException
      ) {
        throw err;
      }
      this.logger.error('Failed to update stock', err);
      throw new InternalServerErrorException('Failed to update stock');
    }
  }
}
