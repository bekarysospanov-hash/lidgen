// Ядро стыка: одна схема описывает и поля формы, и ответы API — моковые
// и настоящие (docs/api-contract.md §1). Типы выводятся из схем, не пишутся руками.
export * from './primitives'
export * from './request'
export * from './otp'
export * from './photo'
export * from './quote'
export * from './master'
export * from './events'
export * from './errors'
