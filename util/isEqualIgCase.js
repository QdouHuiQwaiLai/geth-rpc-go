import _ from 'lodash'
export const isEqualStrIgCase = (str1, str2) => {
  return _.isEqual(str1.toLowerCase(), str2.toLowerCase())
}