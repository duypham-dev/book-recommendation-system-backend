import { prisma } from '#lib/prisma.js';

/**
 * Get dashboard statistics
 */
export const getDashboardStats = async () => {
  // Get counts
  const [
    totalUsers,
    totalBooks,
    totalGenres,
    totalAuthors,
  ] = await prisma.$transaction([
    // Total users (excluding admins)
    prisma.users.count({
      where: {
        roles: { role_name: { not: 'admin' } },
      },
    }),
    
    // Total books
    prisma.books.count({
      where: { is_deleted: false },
    }),
    
    // Total genres
    prisma.genres.count(),
    
    // Total authors
    prisma.authors.count(),
  ]);

  return {
    totalUsers,
    totalBooks,
    totalGenres,
    totalAuthors,
  };
};

/**
 * Get new users count per day for last 7 days
 */
async function getNewUsersByTime(days) {
  // 1. Xác định đúng ranh giới thời gian (Bao gồm cả hôm nay)
  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0); // Reset về 00:00:00 của ngày hôm nay
  startDate.setDate(startDate.getDate() - (days - 1)); // Lùi về đúng số ngày

  // 2. Lấy dữ liệu từ DB
  const users = await prisma.users.findMany({
    where: {
      created_at: { gte: startDate },
      roles: { role_name: { not: 'admin' } },
    },
    select: { created_at: true },
  });

  // 3. Khởi tạo Object đếm với định dạng ngày theo Local (YYYY-MM-DD)
  const countByDate = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const dateStr = d.toLocaleDateString('sv-SE'); 
    countByDate[dateStr] = 0;
  }

  // 4. Đếm số lượng
  users.forEach(user => {
    // Ép created_at (thường là UTC) về đúng múi giờ Local trước khi lấy chuỗi
    const dateStr = new Date(user.created_at).toLocaleDateString('sv-SE');
    
    if (countByDate[dateStr] !== undefined) {
      countByDate[dateStr]++;
    }
  });

  // 5. Trả về mảng
  return Object.entries(countByDate).map(([date, count]) => ({
    date,
    count,
  }));
}

/**
 * Get top rated books with pagination
 */
async function getTopRatedBooks(page = 0, size = 5) {
  const skip = page * size;

  // Get books with average rating
  const booksWithRatings = await prisma.ratings.groupBy({
    by: ['book_id'],
    _avg: { rating_value: true },
    _count: { rating_id: true },
    orderBy: { _avg: { rating_value: 'desc' } },
    skip,
    take: size,
  });

  const bookIds = booksWithRatings.map(r => r.book_id);

  const books = await prisma.books.findMany({
    where: {
      book_id: { in: bookIds },
      is_deleted: false,
    },
    select: {
      book_id: true,
      title: true,
      cover_image_url: true,
    },
  });

  // Get total count
  const totalDistinctBooks = await prisma.ratings.groupBy({
    by: ['book_id'],
  });

  const content = booksWithRatings.map(rating => {
    const book = books.find(b => b.book_id === rating.book_id);
    return {
      id: rating.book_id.toString(),
      title: book?.title || 'Unknown',
      coverImageUrl: book?.cover_image_url,
      averageRating: Math.round((rating._avg.rating_value || 0) * 10) / 10,
      ratingCount: rating._count.rating_id,
    };
  });

  return {
    content,
    number: page,
    size,
    totalElements: totalDistinctBooks.length,
    totalPages: Math.ceil(totalDistinctBooks.length / size),
  };
}

/**
 * Get top favorited books with pagination
 */
async function getTopFavoritedBooks(page = 0, size = 5) {
  const skip = page * size;

  // Get books with favorite count
  const booksWithFavorites = await prisma.favorites.groupBy({
    by: ['book_id'],
    _count: { favorite_id: true },
    orderBy: { _count: { favorite_id: 'desc' } },
    skip,
    take: size,
  });

  const bookIds = booksWithFavorites.map(f => f.book_id);

  const books = await prisma.books.findMany({
    where: {
      book_id: { in: bookIds },
      is_deleted: false,
    },
    select: {
      book_id: true,
      title: true,
      cover_image_url: true,
    },
  });

  // Get total count
  const totalDistinctBooks = await prisma.favorites.groupBy({
    by: ['book_id'],
  });

  const content = booksWithFavorites.map(fav => {
    const book = books.find(b => b.book_id === fav.book_id);
    return {
      id: fav.book_id.toString(),
      title: book?.title || 'Unknown',
      coverImageUrl: book?.cover_image_url,
      favoriteCount: fav._count.favorite_id,
    };
  });

  return {
    content,
    number: page,
    size,
    totalElements: totalDistinctBooks.length,
    totalPages: Math.ceil(totalDistinctBooks.length / size),
  };
}

export const dashboardService = {
  getDashboardStats,
  getNewUsersByTime,
  getTopRatedBooks,
  getTopFavoritedBooks,
};  
