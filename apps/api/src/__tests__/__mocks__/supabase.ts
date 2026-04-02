const mockChain = {
  select:   jest.fn().mockReturnThis(),
  insert:   jest.fn().mockReturnThis(),
  update:   jest.fn().mockReturnThis(),
  eq:       jest.fn().mockReturnThis(),
  filter:   jest.fn().mockReturnThis(),
  limit:    jest.fn().mockReturnThis(),
  order:    jest.fn().mockReturnThis(),
  single:   jest.fn().mockResolvedValue({ data: null, error: null }),
  maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
  then:     jest.fn().mockResolvedValue({ data: null, error: null }),
}

export const supabaseAdmin = {
  from: jest.fn().mockReturnValue(mockChain),
  auth: {
    getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
  },
}

export { mockChain }
