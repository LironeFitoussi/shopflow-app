import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { DATABASE_POOL } from '../database/database.module';
import { REDIS_CLIENT } from '../cache/cache.module';

const mockProduct = {
  id: 1,
  name: 'Widget',
  price: '9.99',
  stock: 10,
  created_at: '2026-06-08T00:00:00.000Z',
};

const mockPool = {
  query: jest.fn(),
};

const mockRedisRef = {
  client: {
    get: jest.fn(),
    setEx: jest.fn(),
    del: jest.fn(),
  },
};

describe('ProductsService', () => {
  let service: ProductsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: DATABASE_POOL, useValue: mockPool },
        { provide: REDIS_CLIENT, useValue: mockRedisRef },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns cached data on cache hit', async () => {
      mockRedisRef.client.get.mockResolvedValue(JSON.stringify([mockProduct]));

      const result = await service.findAll();

      expect(result.source).toBe('cache');
      expect(result.data).toEqual([mockProduct]);
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('queries db and caches on cache miss', async () => {
      mockRedisRef.client.get.mockResolvedValue(null);
      mockPool.query.mockResolvedValue({ rows: [mockProduct] });

      const result = await service.findAll();

      expect(result.source).toBe('db');
      expect(result.data).toEqual([mockProduct]);
      expect(mockRedisRef.client.setEx).toHaveBeenCalledWith(
        'products:all',
        60,
        JSON.stringify([mockProduct]),
      );
    });

    it('queries db when redis is unavailable', async () => {
      const noRedisRef = { client: null };
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ProductsService,
          { provide: DATABASE_POOL, useValue: mockPool },
          { provide: REDIS_CLIENT, useValue: noRedisRef },
        ],
      }).compile();
      const svc = module.get<ProductsService>(ProductsService);

      mockPool.query.mockResolvedValue({ rows: [mockProduct] });

      const result = await svc.findAll();
      expect(result.source).toBe('db');
    });
  });

  describe('findOne', () => {
    it('returns product by id', async () => {
      mockPool.query.mockResolvedValue({ rows: [mockProduct] });

      const result = await service.findOne(1);
      expect(result).toEqual(mockProduct);
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM products WHERE id = $1',
        [1],
      );
    });

    it('throws NotFoundException when product not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStock', () => {
    it('updates stock and invalidates cache', async () => {
      const updated = { ...mockProduct, stock: 9 };
      mockPool.query.mockResolvedValue({ rows: [updated] });

      const result = await service.updateStock(1, -1);

      expect(result.stock).toBe(9);
      expect(mockRedisRef.client.del).toHaveBeenCalledWith('products:all');
    });

    it('throws NotFoundException when product not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await expect(service.updateStock(999, -1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when delta is not a number', async () => {
      await expect(
        service.updateStock(1, 'bad' as unknown as number),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
