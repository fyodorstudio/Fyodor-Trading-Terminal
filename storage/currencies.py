from typing import Literal

CalendarCurrency = Literal["EUR", "GBP", "AUD", "NZD", "USD", "CAD", "CHF", "JPY"]
CURRENCIES = ("EUR", "GBP", "AUD", "NZD", "USD", "CAD", "CHF", "JPY")


def publisher_currencies(version: str):
    if version == "2.0.4":
        return CURRENCIES
    if version == "2.0.3":
        return ("EUR", "USD", "GBP")
    return ("EUR", "USD")
