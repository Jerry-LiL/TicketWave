module.exports =
  process.env.TEST_DATABASE_URL ||
  'postgres://ticketwave:ticketwave@localhost:5432/ticketwave_test';
